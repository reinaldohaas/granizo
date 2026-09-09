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

  public getLWC(xKm: number, zKm: number, params: SimulationParams, T: number): number {
    if (T < -40.0 || T > 12.0 || zKm < 1.5) return 0;

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
