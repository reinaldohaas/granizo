import { describe, it, expect } from 'vitest';
import { AtmosphericProfile } from '../src/simulation/AtmosphericProfile';
import { HailstonePhysics } from '../src/simulation/HailstonePhysics';
import { AccretionModel } from '../src/simulation/AccretionModel';
import { FreezingModel } from '../src/simulation/FreezingModel';
import { MeltingModel } from '../src/simulation/MeltingModel';
import { Mulberry32PRNG } from '../src/simulation/RandomGenerator';
import { GrowthRegime } from '../src/types/simulationTypes';

describe('Atmospheric Profile and Sounding', () => {
  const atmos = new AtmosphericProfile();

  it('verifies temperature decreases with altitude', () => {
    const t0 = atmos.getTemperature(0, 3.0);
    const t3 = atmos.getTemperature(3, 3.0);
    const t6 = atmos.getTemperature(6, 3.0);
    const t12 = atmos.getTemperature(12, 3.0);

    expect(t0).toBe(20.0);
    expect(t3).toBeCloseTo(0.0, 1);
    expect(t6).toBeLessThan(t3);
    expect(t12).toBeCloseTo(-60.0, 1);
  });

  it('verifies air density decreases exponentially with height', () => {
    const rho0 = atmos.getAirDensity(0);
    const rho5 = atmos.getAirDensity(5);
    const rho10 = atmos.getAirDensity(10);

    expect(rho0).toBeCloseTo(1.225, 2);
    expect(rho5).toBeLessThan(rho0);
    expect(rho10).toBeLessThan(rho5);
  });
});

describe('Hailstone Aerodynamics and Growth Physics', () => {
  it('calculates physically plausible terminal velocity', () => {
    const vtSmall = HailstonePhysics.calculateTerminalVelocity(3.0, 1.225, 600.0);
    const vtMedium = HailstonePhysics.calculateTerminalVelocity(15.0, 1.225, 800.0);
    const vtGiant = HailstonePhysics.calculateTerminalVelocity(50.0, 1.225, 917.0);

    expect(vtSmall).toBeGreaterThan(3.0);
    expect(vtSmall).toBeLessThan(12.0);

    expect(vtMedium).toBeGreaterThan(vtSmall);
    expect(vtGiant).toBeGreaterThan(vtMedium);
    expect(vtGiant).toBeLessThan(60.0);
  });

  it('verifies accretion mass gain increases with diameter and LWC', () => {
    const rate1 = AccretionModel.calculateAccretionRate(5.0, 1.0, 15.0);
    const rate2 = AccretionModel.calculateAccretionRate(5.0, 3.0, 15.0);
    const rate3 = AccretionModel.calculateAccretionRate(20.0, 3.0, 15.0);

    expect(rate1).toBeGreaterThan(0);
    expect(rate2).toBeGreaterThan(rate1);
    expect(rate3).toBeGreaterThan(rate2);
  });

  it('determines Dry Growth (Rime) at low temperatures and Wet Growth (Glaze) at higher temperatures', () => {
    const rateCold = AccretionModel.calculateAccretionRate(10.0, 1.0, 15.0);
    const regimeCold = FreezingModel.evaluateRegime(-25.0, rateCold, 10.0, 15.0);

    const rateWarm = AccretionModel.calculateAccretionRate(25.0, 4.0, 30.0);
    const regimeMild = FreezingModel.evaluateRegime(-3.0, rateWarm, 25.0, 30.0);

    expect(regimeCold).toBe(GrowthRegime.DRY);
    expect(regimeMild).toBe(GrowthRegime.WET);
  });

  it('verifies selective melting rate below 0°C', () => {
    const meltSmall = MeltingModel.calculateMeltingRate(12.0, 3.0, 8.0, 0.8);
    const meltLarge = MeltingModel.calculateMeltingRate(12.0, 35.0, 32.0, 0.8);

    expect(meltSmall).toBeGreaterThan(0);
    expect(meltLarge).toBeGreaterThan(0);
    // Relative mass loss (dm/M) is vastly higher for small stones:
    const massSmall = HailstonePhysics.massFromDiameter(3.0, 800.0);
    const massLarge = HailstonePhysics.massFromDiameter(35.0, 900.0);

    const relLossSmall = meltSmall / massSmall;
    const relLossLarge = meltLarge / massLarge;
    expect(relLossSmall).toBeGreaterThan(relLossLarge);
  });
});

describe('PRNG Reproducibility and Numerical Stability', () => {
  it('reproduces identical sequences given the same random seed', () => {
    const rng1 = new Mulberry32PRNG(42);
    const rng2 = new Mulberry32PRNG(42);

    for (let i = 0; i < 20; i++) {
      expect(rng1.next()).toBe(rng2.next());
    }
  });

  it('prevents NaN and Infinite values in physics calculations', () => {
    const vt = HailstonePhysics.calculateTerminalVelocity(0, 1.225, 800.0);
    expect(Number.isNaN(vt)).toBe(false);
    expect(Number.isFinite(vt)).toBe(true);

    const mass = HailstonePhysics.massFromDiameter(0, 800.0);
    expect(mass).toBe(0);

    const diam = HailstonePhysics.diameterFromMass(0, 800.0);
    expect(Number.isNaN(diam)).toBe(false);
    expect(diam).toBeGreaterThanOrEqual(0.2);
  });
});
