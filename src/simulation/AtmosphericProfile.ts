import { SoundingNode } from '../types/simulationTypes';

export class AtmosphericProfile {
  // Exactly 4 NOAA Reference Levels
  public static default4Nodes: SoundingNode[] = [
    { zKm: 0.0, tempC: 18.0, dewPointC: 14.0, label: 'Nível 1 - Superfície (0 km)' },
    { zKm: 2.2, tempC: 5.0, dewPointC: 3.5, label: 'Nível 2 - Baixa Troposfera (2.2 km)' },
    { zKm: 5.5, tempC: -15.0, dewPointC: -17.5, label: 'Nível 3 - Média Troposfera (5.5 km)' },
    { zKm: 9.5, tempC: -42.0, dewPointC: -46.0, label: 'Nível 4 - Alta Troposfera (9.5 km)' }
  ];

  public getTemperature(zKm: number, zFreezingKm: number = 3.0, nodes?: SoundingNode[]): number {
    const list = nodes && nodes.length >= 2 ? nodes : AtmosphericProfile.default4Nodes;
    return this.interpolateValue(zKm, list.map(n => ({ z: n.zKm, val: n.tempC })));
  }

  public getDewPoint(zKm: number, nodes?: SoundingNode[]): number {
    const list = nodes && nodes.length >= 2 ? nodes : AtmosphericProfile.default4Nodes;
    const dp = this.interpolateValue(zKm, list.map(n => ({ z: n.zKm, val: n.dewPointC })));
    const t = this.getTemperature(zKm, 3.0, nodes);
    return Math.min(t, dp); // Strictly enforce Td <= T
  }

  public getDewPointDepression(zKm: number, nodes?: SoundingNode[]): number {
    const t = this.getTemperature(zKm, 3.0, nodes);
    const td = this.getDewPoint(zKm, nodes);
    return Math.max(0, t - td);
  }

  public getRelativeHumidity(zKm: number, nodes?: SoundingNode[]): number {
    const t = this.getTemperature(zKm, 3.0, nodes);
    const td = this.getDewPoint(zKm, nodes);
    // Clausius-Clapeyron saturation vapor pressure ratio
    const es = 6.112 * Math.exp((17.67 * t) / (t + 243.5));
    const e = 6.112 * Math.exp((17.67 * td) / (td + 243.5));
    return Math.min(1.0, Math.max(0.05, e / es));
  }

  /**
   * Cloud density factor (0 to 1) based on saturation (T - Td)
   */
  public getCloudDensity(zKm: number, nodes?: SoundingNode[]): number {
    const dep = this.getDewPointDepression(zKm, nodes);
    if (dep <= 2.0) return 1.0; // Saturated cloud
    if (dep >= 8.0) return 0.05; // Dry clear air
    return 1.0 - (dep - 2.0) / 6.0;
  }

  public getAirDensity(zKm: number): number {
    const rho0 = 1.225;
    const H = 8.5;
    return rho0 * Math.exp(-zKm / H);
  }

  public getFreezingLevel(nodes?: SoundingNode[], fallback: number = 3.0): number {
    const list = nodes && nodes.length >= 2 ? nodes : AtmosphericProfile.default4Nodes;
    for (let i = 0; i < list.length - 1; i++) {
      const n1 = list[i];
      const n2 = list[i + 1];
      if ((n1.tempC >= 0 && n2.tempC <= 0) || (n1.tempC <= 0 && n2.tempC >= 0)) {
        if (Math.abs(n2.tempC - n1.tempC) > 0.001) {
          const frac = (0 - n1.tempC) / (n2.tempC - n1.tempC);
          return Math.max(0, Math.min(12, n1.zKm + frac * (n2.zKm - n1.zKm)));
        }
      }
    }
    return fallback;
  }

  public getIsothermAltitudes(zFreezingKm: number) {
    return {
      zMinus10C: zFreezingKm + 1.8,
      zMinus20C: zFreezingKm + 3.4,
      zMinus30C: zFreezingKm + 4.9,
      zMinus40C: zFreezingKm + 6.3
    };
  }

  /**
   * Diagnostic classification according to NOAA NESDIS / CIMSS rules
   */
  public static classifyPrecipitation(nodes: SoundingNode[]): {
    type: 'neve' | 'chuva' | 'sleet' | 'chuva_congelante';
    name: string;
    description: string;
  } {
    const prof = new AtmosphericProfile();
    return prof.classifyPrecipitation(nodes);
  }

  public classifyPrecipitation(nodes: SoundingNode[]): {
    type: 'neve' | 'chuva' | 'sleet' | 'chuva_congelante';
    name: string;
    description: string;
  } {
    const list = nodes && nodes.length === 4 ? nodes : AtmosphericProfile.default4Nodes;
    const tSurf = list[0].tempC;
    const maxTemp = Math.max(...list.map(n => n.tempC));

    // 1. Snow: Entire atmospheric column subfreezing (maxTemp <= 0)
    if (maxTemp <= 0.0) {
      return {
        type: 'neve',
        name: 'Neve (Snow)',
        description: 'Toda a coluna atmosférica permanece abaixo de 0°C. O floco de neve permanece congelado até o solo.'
      };
    }

    // Has a melting warm layer (maxTemp > 0)
    if (tSurf > 0.0) {
      // Warm at ground
      return {
        type: 'chuva',
        name: 'Chuva (Rain)',
        description: 'Camada quente profunda (> 0°C) derrete todo o gelo. A precipitação atinge a superfície como chuva líquida.'
      };
    } else {
      // Warm nose aloft, but surface is subfreezing (tSurf <= 0)
      // Check depth and intensity of the cold surface layer
      const coldLayerDepth = this.getSurfaceColdLayerDepth(list);
      const minColdT = this.getMinColdLayerTemp(list, coldLayerDepth);

      if (coldLayerDepth >= 1.2 && minColdT <= -2.5) {
        return {
          type: 'sleet',
          name: 'Pelotas de gelo (sleet)',
          description: 'A neve derrete na camada quente em altitude e depois RECONGELA ao atravessar a camada fria inferior profunda.'
        };
      } else {
        return {
          type: 'chuva_congelante',
          name: 'Chuva congelante (Freezing Rain)',
          description: 'A gota líquida atravessa uma camada fria rasa (< 1 km), torna-se super-resfriada e CONGELA NO CONTATO com o solo.'
        };
      }
    }
  }

  private getSurfaceColdLayerDepth(list: SoundingNode[]): number {
    for (let z = 0.1; z <= 6.0; z += 0.1) {
      const t = this.getTemperature(z, 3.0, list);
      if (t >= 0.0) return z;
    }
    return 3.0;
  }

  private getMinColdLayerTemp(list: SoundingNode[], depthKm: number): number {
    let minT = 0;
    for (let z = 0.0; z <= depthKm; z += 0.2) {
      const t = this.getTemperature(z, 3.0, list);
      if (t < minT) minT = t;
    }
    return minT;
  }

  private interpolateValue(zKm: number, points: Array<{ z: number; val: number }>): number {
    if (zKm <= points[0].z) return points[0].val;
    if (zKm >= points[points.length - 1].z) return points[points.length - 1].val;

    for (let i = 0; i < points.length - 1; i++) {
      if (zKm >= points[i].z && zKm <= points[i + 1].z) {
        const frac = (zKm - points[i].z) / (points[i + 1].z - points[i].z);
        return points[i].val + frac * (points[i + 1].val - points[i].val);
      }
    }
    return points[0].val;
  }
}
