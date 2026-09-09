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

  it('verifies temperature decreases with altitude in standard troposphere', () => {
    const t0 = atmos.getTemperature(0);
    const t3 = atmos.getTemperature(3);
    const t6 = atmos.getTemperature(6);
    const t12 = atmos.getTemperature(12);

    expect(t0).toBe(18.0);
    expect(t3).toBeLessThan(t0);
    expect(t6).toBeLessThan(t3);
    expect(t12).toBeLessThan(t6);
  });

  it('strictly enforces physical constraint Td <= T across all altitudes', () => {
    // Attempt invalid nodes where Td > T
    const invalidNodes = [
      { zKm: 0.0, tempC: 10.0, dewPointC: 25.0, label: 'L1' },
      { zKm: 2.0, tempC: 5.0, dewPointC: 10.0, label: 'L2' },
      { zKm: 5.0, tempC: -5.0, dewPointC: 0.0, label: 'L3' },
      { zKm: 10.0, tempC: -40.0, dewPointC: -30.0, label: 'L4' }
    ];
    const safeAtmos = new AtmosphericProfile();
    for (let z = 0; z <= 12; z += 0.5) {
      const t = safeAtmos.getTemperature(z, 3.0, invalidNodes);
      const td = safeAtmos.getDewPoint(z, invalidNodes);
      expect(td).toBeLessThanOrEqual(t);
    }
  });

  it('classifies precipitation according to NOAA NESDIS rules', () => {
    // 1. Snow (entire column subfreezing)
    const snowNodes = [
      { zKm: 0.0, tempC: -3.0, dewPointC: -4.0, label: 'L1' },
      { zKm: 2.0, tempC: -7.0, dewPointC: -8.0, label: 'L2' },
      { zKm: 5.0, tempC: -18.0, dewPointC: -20.0, label: 'L3' },
      { zKm: 9.0, tempC: -35.0, dewPointC: -40.0, label: 'L4' }
    ];
    expect(AtmosphericProfile.classifyPrecipitation(snowNodes).type).toBe('neve');

    // 2. Sleet (warm aloft, deep cold layer >= 1.2km)
    const sleetNodes = [
      { zKm: 0.0, tempC: -4.0, dewPointC: -5.0, label: 'L1' },
      { zKm: 1.8, tempC: -5.0, dewPointC: -6.0, label: 'L2' },
      { zKm: 4.5, tempC: 5.0, dewPointC: 3.0, label: 'L3' },
      { zKm: 9.0, tempC: -28.0, dewPointC: -32.0, label: 'L4' }
    ];
    expect(AtmosphericProfile.classifyPrecipitation(sleetNodes).type).toBe('sleet');

    // 3. Freezing Rain (warm aloft, shallow cold layer < 1.0km)
    const freezingRainNodes = [
      { zKm: 0.0, tempC: -2.0, dewPointC: -3.0, label: 'L1' },
      { zKm: 0.8, tempC: -1.0, dewPointC: -2.0, label: 'L2' },
      { zKm: 4.0, tempC: 7.0, dewPointC: 5.0, label: 'L3' },
      { zKm: 9.0, tempC: -25.0, dewPointC: -30.0, label: 'L4' }
    ];
    expect(AtmosphericProfile.classifyPrecipitation(freezingRainNodes).type).toBe('chuva_congelante');

    // 4. Rain (surface warm)
    const rainNodes = [
      { zKm: 0.0, tempC: 16.0, dewPointC: 13.0, label: 'L1' },
      { zKm: 2.5, tempC: 6.0, dewPointC: 4.0, label: 'L2' },
      { zKm: 5.0, tempC: -10.0, dewPointC: -12.0, label: 'L3' },
      { zKm: 9.0, tempC: -32.0, dewPointC: -35.0, label: 'L4' }
    ];
    expect(AtmosphericProfile.classifyPrecipitation(rainNodes).type).toBe('chuva');
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
