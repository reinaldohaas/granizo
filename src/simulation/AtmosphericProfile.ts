import { SoundingNode } from '../types/simulationTypes';

export class AtmosphericProfile {
  public static defaultSoundingNodes: SoundingNode[] = [
    { zKm: 0.0, tempC: 20.0, dewPointC: 15.0, label: 'Superfície' },
    { zKm: 1.5, tempC: 10.0, dewPointC: 9.0, label: 'Base Nuvem' },
    { zKm: 3.0, tempC: 0.0, dewPointC: -2.0, label: 'Nível 0°C' },
    { zKm: 5.5, tempC: -18.0, dewPointC: -22.0, label: 'Zona Rime' },
    { zKm: 8.5, tempC: -38.0, dewPointC: -44.0, label: 'Nucleação' },
    { zKm: 12.0, tempC: -60.0, dewPointC: -66.0, label: 'Topo' }
  ];

  public getTemperature(zKm: number, zFreezingKm: number = 3.0, nodes?: SoundingNode[]): number {
    if (nodes && nodes.length >= 2) {
      return this.interpolateTemp(zKm, nodes);
    }
    // Fallback piecewise
    if (zKm <= zFreezingKm) {
      const lapse = 20.0 / Math.max(0.5, zFreezingKm);
      return 20.0 - lapse * zKm;
    } else {
      const deltaZ = zKm - zFreezingKm;
      const lapseAloft = 60.0 / Math.max(1.0, 12.0 - zFreezingKm);
      return -lapseAloft * deltaZ;
    }
  }

  public getDewPoint(zKm: number, nodes?: SoundingNode[]): number {
    const list = nodes || AtmosphericProfile.defaultSoundingNodes;
    if (zKm <= list[0].zKm) return list[0].dewPointC;
    if (zKm >= list[list.length - 1].zKm) return list[list.length - 1].dewPointC;

    for (let i = 0; i < list.length - 1; i++) {
      if (zKm >= list[i].zKm && zKm <= list[i + 1].zKm) {
        const frac = (zKm - list[i].zKm) / (list[i + 1].zKm - list[i].zKm);
        return list[i].dewPointC + frac * (list[i + 1].dewPointC - list[i].dewPointC);
      }
    }
    return -65.0;
  }

  private interpolateTemp(zKm: number, nodes: SoundingNode[]): number {
    if (zKm <= nodes[0].zKm) return nodes[0].tempC;
    if (zKm >= nodes[nodes.length - 1].zKm) return nodes[nodes.length - 1].tempC;

    for (let i = 0; i < nodes.length - 1; i++) {
      if (zKm >= nodes[i].zKm && zKm <= nodes[i + 1].zKm) {
        const frac = (zKm - nodes[i].zKm) / (nodes[i + 1].zKm - nodes[i].zKm);
        return nodes[i].tempC + frac * (nodes[i + 1].tempC - nodes[i].tempC);
      }
    }
    return -60.0;
  }

  public getAirDensity(zKm: number): number {
    const rho0 = 1.225;
    const H = 8.5;
    return rho0 * Math.exp(-zKm / H);
  }

  public getFreezingLevel(nodes?: SoundingNode[], fallback: number = 3.0): number {
    const list = nodes || AtmosphericProfile.defaultSoundingNodes;
    for (let i = 0; i < list.length - 1; i++) {
      const n1 = list[i];
      const n2 = list[i + 1];
      if ((n1.tempC >= 0 && n2.tempC <= 0) || (n1.tempC <= 0 && n2.tempC >= 0)) {
        if (Math.abs(n2.tempC - n1.tempC) < 0.001) return n1.zKm;
        const frac = (0 - n1.tempC) / (n2.tempC - n1.tempC);
        return n1.zKm + frac * (n2.zKm - n1.zKm);
      }
    }
    return fallback;
  }

  public getIsothermAltitudes(zFreezingKm: number, nodes?: SoundingNode[]): {
    z0C: number;
    zMinus10C: number;
    zMinus20C: number;
    zMinus30C: number;
    zMinus40C: number;
  } {
    const z0 = this.getFreezingLevel(nodes, zFreezingKm);
    const lapseAloft = 60.0 / Math.max(1.0, 12.0 - z0);
    return {
      z0C: z0,
      zMinus10C: z0 + 10.0 / lapseAloft,
      zMinus20C: z0 + 20.0 / lapseAloft,
      zMinus30C: z0 + 30.0 / lapseAloft,
      zMinus40C: z0 + 40.0 / lapseAloft,
    };
  }
}
