import { HailstonePhysics } from './HailstonePhysics';

export class AccretionModel {
  /**
   * Collection efficiency E(D):
   * Small graupel (<3 mm) has low collision efficiency (~0.5 - 0.7)
   * Large hail (>10 mm) has high collection efficiency (~0.85 - 0.95)
   */
  public static getCollectionEfficiency(diameterMm: number): number {
    if (diameterMm < 2.0) return 0.50;
    if (diameterMm < 5.0) return 0.70;
    if (diameterMm < 15.0) return 0.85;
    return 0.92;
  }

  /**
   * Continuous accretion rate: dm/dt = E * LWC * A * |Vrel|
   * Returns mass gain rate in grams/second (g/s)
   */
  public static calculateAccretionRate(
    diameterMm: number,
    lwcGm3: number,
    vRelMs: number
  ): number {
    if (lwcGm3 <= 0 || diameterMm <= 0) return 0;

    const Dm = diameterMm / 1000.0;
    const crossAreaM2 = Math.PI * Math.pow(Dm / 2.0, 2);
    const E = this.getCollectionEfficiency(diameterMm);

    // dm/dt = E * LWC(kg/m^3) * A(m^2) * |Vrel|(m/s)
    const lwcKgM3 = lwcGm3 / 1000.0;
    const dmKgPerSec = E * lwcKgM3 * crossAreaM2 * Math.abs(vRelMs);

    return dmKgPerSec * 1000.0; // g/s
  }
}
