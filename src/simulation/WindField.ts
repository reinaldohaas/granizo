import { createNoise2D } from 'simplex-noise';
import { SimulationParams } from '../types/simulationTypes';
import { globalRNG } from './RandomGenerator';

export class WindField {
  private noise2D = createNoise2D(() => globalRNG.next());

  public reseed(): void {
    this.noise2D = createNoise2D(() => globalRNG.next());
  }

  /**
   * Evaluates wind field at position (xKm, zKm) and time tSec
   * Returns [u_ar, w_ar] in m/s
   */
  public evaluate(
    xKm: number,
    zKm: number,
    tSec: number,
    params: SimulationParams
  ): { u: number; w: number } {
    if (zKm < 0.2 || zKm > 13.5) {
      return { u: 0, w: 0 };
    }

    // Updraft core center x_c(z) with tilt
    const xBase = 10.0; // km
    const tiltOffset = Math.tan((params.updraftTiltDeg * Math.PI) / 180) * zKm;
    const xCenter = xBase + tiltOffset;

    // Updraft radius
    const halfWidth = Math.max(0.4, params.updraftWidthKm / 2);
    const dx = xKm - xCenter;

    // Horizontal Gaussian factor
    const rSq = (dx * dx) / (2 * halfWidth * halfWidth);
    const horizProfile = Math.exp(-rSq);

    // Vertical sine factor peaking around mid levels (6 to 8 km)
    let vertProfile = Math.sin((zKm / 13.0) * Math.PI);
    if (zKm < 3.0) vertProfile *= 0.6; // weaker near inflow base

    // Stage speed multiplier
    let stageMultiplier = 1.0;
    if (params.currentStage === 1) stageMultiplier = 0.12; // 2 - 5 m/s
    else if (params.currentStage === 2) stageMultiplier = 0.65; // 15 - 25 m/s
    else if (params.currentStage >= 3) stageMultiplier = 1.0;  // 30 - 50 m/s

    // Core vertical wind w_corrente
    const wCore = params.wMax * stageMultiplier * vertProfile * horizProfile;

    // Compensating peripheral downdraft on flanks
    let wDowndraft = 0;
    if (Math.abs(dx) > halfWidth * 1.5 && Math.abs(dx) < halfWidth * 3.5 && zKm < 10.0) {
      wDowndraft = -0.25 * params.wMax * stageMultiplier * Math.sin((zKm / 10.0) * Math.PI);
    }

    // Horizontal wind u_ar: environmental shear + cloud inflow/divergence
    let uEnv = params.shearStrength * (zKm - 1.5);
    // Inflow at base (z < 3 km)
    let uInflow = 0;
    if (zKm < 3.0) {
      uInflow = -Math.sign(dx) * Math.min(6.0, Math.abs(dx) * 1.5);
    }
    // Divergence at anvil top (z > 9.5 km)
    let uDivergence = 0;
    if (zKm > 9.5) {
      uDivergence = Math.sign(dx) * Math.min(12.0, (zKm - 9.5) * 3.0);
    }

    // Smooth Simplex Noise perturbations
    const noiseScale = 0.35;
    const timeScale = 0.4;
    const turbAmp = params.turbulenceIntensity * 3.5;
    const wTurb = this.noise2D(xKm * noiseScale, zKm * noiseScale + tSec * timeScale) * turbAmp;
    const uTurb = this.noise2D(xKm * noiseScale + 10, zKm * noiseScale - tSec * timeScale) * turbAmp;

    const wTotal = wCore + wDowndraft + wTurb;
    const uTotal = uEnv + uInflow + uDivergence + uTurb;

    return { u: uTotal, w: wTotal };
  }

  /**
   * Supercooled Liquid Water content at (x, z)
   */
  public getLWC(xKm: number, zKm: number, params: SimulationParams, T: number): number {
    // LWC is only liquid when T > -40°C
    if (T < -40.0 || T > 15.0 || zKm < 1.5) return 0;

    const tiltOffset = Math.tan((params.updraftTiltDeg * Math.PI) / 180) * zKm;
    const xCenter = 10.0 + tiltOffset;
    const halfWidth = params.updraftWidthKm * 0.9;
    const dx = Math.abs(xKm - xCenter);

    if (dx > halfWidth * 2.0) return 0.1; // background moisture

    // LWC peaks in updraft core between 0°C and -25°C
    const horizFactor = Math.exp(-(dx * dx) / (2 * halfWidth * halfWidth));
    let thermalFactor = 1.0;
    if (T < 0 && T >= -25) thermalFactor = 1.0;
    else if (T < -25) thermalFactor = Math.max(0.0, 1.0 - ((-25 - T) / 15.0)); // glaciates above -40°C
    else thermalFactor = 0.8;

    return params.lwcMax * horizFactor * thermalFactor;
  }
}
