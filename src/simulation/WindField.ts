import { createNoise2D } from 'simplex-noise';
import { SimulationParams } from '../types/simulationTypes';
import { globalRNG } from './RandomGenerator';

export class WindField {
  private noise2D = createNoise2D(() => globalRNG.next());

  public reseed(): void {
    this.noise2D = createNoise2D(() => globalRNG.next());
  }

  public getUpdraftX(zKm: number, tiltDeg: number): number {
    const xBase = 8.5; // km
    const tiltOffset = Math.tan((tiltDeg * Math.PI) / 180) * zKm;
    return xBase + tiltOffset;
  }

  public getDowndraftX(zKm: number): number {
    const xBaseDown = 15.2; // km
    return xBaseDown + 0.12 * zKm;
  }

  public isInsideDowndraft(xKm: number, zKm: number): boolean {
    if (zKm > 10.5) return false;
    const xCenter = this.getDowndraftX(zKm);
    const halfWidth = 2.4; // km
    return Math.abs(xKm - xCenter) <= halfWidth;
  }

  public evaluate(
    xKm: number,
    zKm: number,
    tSec: number,
    params: SimulationParams
  ): { u: number; w: number } {
    if (zKm < 0.1 || zKm > 13.8) {
      return { u: 0, w: 0 };
    }

    // Specialized physical lifecycle for Byers & Braham (1949) Ordinary Cell (Tempestade Comum)
    if (params.activeScenario === 'tempestade_comum') {
      return this.evaluateOrdinaryCell(xKm, zKm, tSec, params);
    }

    // 1. Updraft Core: tilted upward jet
    const xUp = this.getUpdraftX(zKm, params.updraftTiltDeg);
    const halfWidthUp = Math.max(0.6, params.updraftWidthKm * 0.7);
    const dxUp = xKm - xUp;
    const rSqUp = (dxUp * dxUp) / (2 * halfWidthUp * halfWidthUp);
    const horizProfileUp = Math.exp(-rSqUp);

    let vertProfileUp = Math.sin((zKm / 13.5) * Math.PI);
    if (zKm < 2.5) vertProfileUp *= 0.65;

    let stageMultiplier = 1.0;
    if (params.currentStage === 1) stageMultiplier = 0.25;
    else if (params.currentStage === 2) stageMultiplier = 0.7;
    else stageMultiplier = 1.0;

    const wUpdraft = params.wMax * stageMultiplier * vertProfileUp * horizProfileUp;

    // 2. Downdraft Core (Corrente Descendente): cold downward jet in precipitation shaft
    const xDown = this.getDowndraftX(zKm);
    const halfWidthDown = 2.0; // km
    const dxDown = xKm - xDown;
    const rSqDown = (dxDown * dxDown) / (2 * halfWidthDown * halfWidthDown);
    const horizProfileDown = Math.exp(-rSqDown);

    let vertProfileDown = 0;
    if (zKm <= 9.5) {
      vertProfileDown = Math.sin((zKm / 10.0) * Math.PI);
      if (zKm < 3.0) vertProfileDown = Math.max(0.5, vertProfileDown);
    }
    const maxDowndraftSpeed = 0.6 * params.wMax * stageMultiplier;
    const wDowndraft = -maxDowndraftSpeed * vertProfileDown * horizProfileDown;

    // 3. Recirculation flow: pulls falling hailstones at mid-levels back into updraft core
    let uRecirc = 0;
    if (zKm >= 3.0 && zKm <= 8.5 && xKm > xUp && xKm < xDown + 1.0) {
      const vertRecirc = Math.sin(((zKm - 3.0) / 5.5) * Math.PI);
      uRecirc = -7.5 * vertRecirc * stageMultiplier;
    }

    // Inflow at cloud base
    let uInflow = 0;
    if (zKm < 3.0) {
      if (xKm < xUp) uInflow = 4.5;
      else if (xKm > xUp && xKm < xDown) uInflow = -3.5;
    }

    // Divergence at anvil summit
    let uDivergence = 0;
    if (zKm > 9.0) {
      const divFactor = Math.min(1.0, (zKm - 9.0) / 3.0);
      uDivergence = (dxUp > 0 ? 12.0 : -6.0) * divFactor;
    }

    const uShear = params.shearStrength * (zKm - 1.5);
    const turbAmp = params.turbulenceIntensity * 2.5;
    const wTurb = this.noise2D(xKm * 0.3, zKm * 0.3 + tSec * 0.4) * turbAmp;
    const uTurb = this.noise2D(xKm * 0.3 + 15, zKm * 0.3 - tSec * 0.4) * turbAmp;

    const wTotal = wUpdraft + wDowndraft + wTurb;
    const uTotal = uShear + uInflow + uRecirc + uDivergence + uTurb;

    return { u: uTotal, w: wTotal };
  }

  public evaluateOrdinaryCell(
    xKm: number,
    zKm: number,
    tSec: number,
    params: SimulationParams
  ): { u: number; w: number } {
    const xCenter = 9.0;
    const tMin = Math.max(0, Math.min(30, params.stormMinutes ?? 0));

    // Vertical top altitude matching Byers & Braham (1949)
    let zTop = 4.0;
    if (tMin <= 10.0) {
      zTop = 4.0 + (tMin / 10.0) * 2.2; // 4.0 to 6.2 km
    } else if (tMin <= 15.0) {
      zTop = 6.2 + ((tMin - 10.0) / 5.0) * 2.8; // 6.2 to 9.0 km
    } else if (tMin <= 20.0) {
      zTop = 9.0 + ((tMin - 15.0) / 5.0) * 2.0; // 9.0 to 11.0 km
    } else {
      zTop = 11.0;
    }

    if (zKm > zTop + 0.6) {
      return { u: 0, w: 0 };
    }

    const dx = xKm - xCenter;
    const halfWidth = 2.4;
    const horizDistSq = (dx * dx) / (2 * halfWidth * halfWidth);
    const horizGauss = Math.exp(-horizDistSq);

    let wUpdraft = 0;
    let wDowndraft = 0;
    let uInflow = 0;
    let uDivergence = 0;

    if (tMin < 15.0) {
      // 1. ESTÁGIO DE CUMULUS (0 a 15 min): Updraft puro e convergência na base
      const intensity = 0.5 + (tMin / 15.0) * 0.5;
      const vertSin = Math.sin((zKm / (zTop * 1.05)) * Math.PI);
      wUpdraft = params.wMax * intensity * Math.max(0, vertSin) * horizGauss;

      // Inflow na base convergindo para o centro
      if (zKm < 2.8) {
        uInflow = (dx < 0 ? 5.5 : -5.5) * (1.0 - Math.min(1.0, Math.abs(dx) / 5.5));
      }
    } else if (tMin <= 22.0) {
      // 2. ESTÁGIO MADURO (15 a 22 min, pico aos 20 min): Updraft no topo + Downdraft violento na base/meio
      const maturePhase = (tMin - 15.0) / 7.0;

      if (zKm >= 4.0) {
        const vertUp = Math.sin(((zKm - 3.5) / (zTop - 3.5)) * Math.PI);
        wUpdraft = params.wMax * Math.max(0, vertUp) * horizGauss * (1.1 - 0.4 * maturePhase);
      }

      if (zKm <= 7.5) {
        const vertDown = Math.sin((zKm / 7.5) * Math.PI);
        const downdraftIntensity = 0.5 + 0.6 * Math.sin(maturePhase * Math.PI);
        wDowndraft = -14.0 * downdraftIntensity * (zKm < 2.5 ? 0.85 : vertDown) * horizGauss;
      }

      // Divergência na bigorna (topo)
      if (zKm > 8.5) {
        uDivergence = (dx > 0 ? 14.0 : -14.0) * Math.min(1.0, (zKm - 8.5) / 2.2);
      }
      // Rajada de saída (gust front) na superfície
      if (zKm < 1.8) {
        uInflow = (dx > 0 ? 8.5 : -8.5) * (1.0 - zKm / 1.8);
      }
    } else {
      // 3. ESTÁGIO DE DISSIPAÇÃO (22 a 30 min): Updraft colapsado, Downdraft dominante
      const dissipPhase = (tMin - 22.0) / 8.0;
      wUpdraft = 0;

      if (zKm <= 8.5) {
        const vertDown = Math.sin((zKm / 8.5) * Math.PI);
        wDowndraft = -9.5 * (1.0 - dissipPhase * 0.4) * Math.max(0.4, vertDown) * horizGauss;
      }

      if (zKm < 1.8) {
        uInflow = (dx > 0 ? 5.5 : -5.5) * (1.0 - dissipPhase);
      }
    }

    const turbAmp = params.turbulenceIntensity * 1.8;
    const wTurb = this.noise2D(xKm * 0.4, zKm * 0.4 + tSec * 0.5) * turbAmp;
    const uTurb = this.noise2D(xKm * 0.4 + 20, zKm * 0.4 - tSec * 0.5) * turbAmp;

    return {
      u: uInflow + uDivergence + uTurb,
      w: wUpdraft + wDowndraft + wTurb
    };
  }

  public getLWC(xKm: number, zKm: number, params: SimulationParams, T: number): number {
    if (T < -40.0 || T > 12.0 || zKm < 1.5) return 0;

    if (params.activeScenario === 'tempestade_comum') {
      const xCenter = 9.0;
      const tMin = Math.max(0, Math.min(30, params.stormMinutes ?? 0));
      const dx = Math.abs(xKm - xCenter);
      const halfWidth = 2.4;
      if (dx > halfWidth * 2.0) return 0.1;
      const horizFactor = Math.exp(-(dx * dx) / (2 * halfWidth * halfWidth));

      // Scale LWC with concentric cores 1, 3, 5
      let coreMax = 1.2; // 0 to 8 min: core 1
      if (tMin >= 8.0 && tMin < 15.0) {
        coreMax = 1.2 + ((tMin - 8.0) / 7.0) * 2.0; // core 1 to 3
      } else if (tMin >= 15.0 && tMin <= 22.0) {
        coreMax = 4.8; // mature core 5
      } else if (tMin > 22.0) {
        coreMax = Math.max(0.2, 4.8 * (1.0 - (tMin - 22.0) / 8.0)); // depleting
      }
      return coreMax * horizFactor;
    }

    const xUp = this.getUpdraftX(zKm, params.updraftTiltDeg);
    const halfWidth = params.updraftWidthKm * 0.9;
    const dx = Math.abs(xKm - xUp);

    if (dx > halfWidth * 2.2) return 0.15;

    const horizFactor = Math.exp(-(dx * dx) / (2 * halfWidth * halfWidth));
    let thermalFactor = 1.0;
    if (T < 0 && T >= -25) thermalFactor = 1.0;
    else if (T < -25) thermalFactor = Math.max(0.0, 1.0 - ((-25 - T) / 15.0));
    else thermalFactor = 0.8;

    return params.lwcMax * horizFactor * thermalFactor;
  }
}
