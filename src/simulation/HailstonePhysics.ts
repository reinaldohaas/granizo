export class HailstonePhysics {
  // Gravitational acceleration (m/s^2)
  public static readonly G = 9.80665;
  // Latent heat of fusion (J/kg)
  public static readonly LF = 3.34e5;
  // Standard air density at sea level (kg/m^3)
  public static readonly RHO_0 = 1.225;

  /**
   * Terminal fall velocity vt(D, z) in m/s
   * D: diameter in mm
   * rhoAir: air density in kg/m^3
   * rhoHail: hailstone density in kg/m^3
   */
  public static calculateTerminalVelocity(
    diameterMm: number,
    rhoAir: number,
    rhoHail: number = 900.0
  ): number {
    const Dm = Math.max(0.0001, diameterMm / 1000.0); // mm to meters
    // Drag coefficient Cd: 0.8 for small graupel, 0.55 for smooth spherical hail
    let Cd = 0.60;
    if (diameterMm < 5.0) Cd = 0.80; // higher drag for porous graupel
    else if (diameterMm > 25.0) Cd = 0.55;

    // vt = sqrt((4 * rho_h * g * D) / (3 * rho_a * Cd))
    const vt = Math.sqrt((4.0 * rhoHail * this.G * Dm) / (3.0 * rhoAir * Cd));
    return Math.min(65.0, Math.max(0.5, vt)); // capped physically
  }

  /**
   * Density based on growth type and diameter
   */
  public static getDensity(diameterMm: number, isGlaze: boolean): number {
    if (diameterMm < 3.0) return 600.0; // graupel / snow embryo: porous
    return isGlaze ? 917.0 : 800.0; // Glaze is pure compact ice; Rime has trapped air
  }

  /**
   * Mass from diameter and density (returns grams)
   */
  public static massFromDiameter(diameterMm: number, densityKgM3: number): number {
    const radiusM = (diameterMm / 2.0) / 1000.0;
    const volumeM3 = (4.0 / 3.0) * Math.PI * Math.pow(radiusM, 3);
    return volumeM3 * densityKgM3 * 1000.0; // to grams
  }

  /**
   * Diameter from mass and density (returns mm)
   */
  public static diameterFromMass(massG: number, densityKgM3: number): number {
    const massKg = massG / 1000.0;
    const volumeM3 = massKg / densityKgM3;
    const radiusM = Math.cbrt((3.0 * volumeM3) / (4.0 * Math.PI));
    return Math.max(0.2, radiusM * 2.0 * 1000.0);
  }

  /**
   * Aerodynamic drag and gravity velocity update
   */
  public static updateVelocity(
    currentVx: number,
    currentVz: number,
    uAir: number,
    wAir: number,
    diameterMm: number,
    rhoAir: number,
    rhoHail: number,
    dt: number
  ): { vx: number; vz: number } {
    const Dm = Math.max(0.0001, diameterMm / 1000.0);
    const massKg = this.massFromDiameter(diameterMm, rhoHail) / 1000.0;
    const areaM2 = Math.PI * Math.pow(Dm / 2.0, 2);

    let Cd = 0.60;
    if (diameterMm < 5.0) Cd = 0.80;

    // Relative velocity vector (Particle - Air)
    const vRelX = currentVx - uAir;
    const vRelZ = currentVz - wAir;
    const vRelMag = Math.hypot(vRelX, vRelZ);

    if (vRelMag < 0.001 || massKg <= 0) {
      return { vx: uAir, vz: wAir - this.G * dt };
    }

    // Drag force: Fd = 0.5 * Cd * rho_a * A * v_rel * |v_rel|
    const dragForceFactor = 0.5 * Cd * rhoAir * areaM2 * vRelMag;
    const aDragX = - (dragForceFactor * vRelX) / massKg;
    const aDragZ = - (dragForceFactor * vRelZ) / massKg;

    // Integrate accelerations: a_x = aDragX, a_z = -g + aDragZ
    const nextVx = currentVx + aDragX * dt;
    const nextVz = currentVz + (-this.G + aDragZ) * dt;

    return { vx: nextVx, vz: nextVz };
  }
}
