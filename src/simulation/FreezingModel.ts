import { GrowthRegime } from '../types/simulationTypes';
import { HailstonePhysics } from './HailstonePhysics';

export class FreezingModel {
  /**
   * Evaluates Schumann-Ludlam transition:
   * Critical accretion rate above which the stone surface cannot dissipate
   * the latent heat of fusion of all collected supercooled water.
   */
  public static evaluateRegime(
    temperatureC: number,
    accretionRateGPerS: number,
    diameterMm: number,
    vRelMs: number
  ): GrowthRegime {
    // If warm air (T >= 0°C), no freezing accretion (melting instead)
    if (temperatureC >= 0) {
      return GrowthRegime.MELTING;
    }

    // No accretion
    if (accretionRateGPerS <= 0.0001) {
      return GrowthRegime.NONE;
    }

    const Dm = Math.max(0.001, diameterMm / 1000.0);
    const Ka = 0.024; // Thermal conductivity of air (W / m K)
    const deltaT = -temperatureC; // positive temperature deficit (e.g. 25 K at -25°C)

    // Ventilation factor: f_v = 1 + 0.3 * Re^0.5
    const Re = (1.2 * Math.abs(vRelMs) * Dm) / 1.7e-5;
    const fVent = 1.0 + 0.28 * Math.sqrt(Math.max(1.0, Re));

    // Latent heat dissipation via sensible conduction + vapor evaporation (Bowen factor ~ 2.8)
    const effectiveConductivity = Ka * 2.8;

    // Maximum rate of heat dissipation to air: Qcrit ~ 4 * pi * r * Ka_eff * deltaT * fVent (Watts)
    const radiusM = Dm / 2.0;
    const qCritWatts = 4.0 * Math.PI * radiusM * effectiveConductivity * deltaT * fVent;

    // Latent heat generation rate: Qgen = (dm/dt) * Lf
    const dmKgS = accretionRateGPerS / 1000.0;
    const qGenWatts = dmKgS * HailstonePhysics.LF;

    // Schumann-Ludlam criterion:
    // If Qgen <= Qcrit -> All water freezes instantly -> DRY GROWTH (Rime)
    // If Qgen > Qcrit  -> Liquid film forms on surface -> WET GROWTH (Glaze)
    if (qGenWatts <= qCritWatts) {
      return GrowthRegime.DRY;
    } else {
      return GrowthRegime.WET;
    }
  }
}
