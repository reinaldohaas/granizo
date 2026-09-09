import { SimulationParams } from '../types/simulationTypes';

export interface SoundingLevel {
  zKm: number;
  temperatureC: number;
}

export class AtmosphericProfile {
  // Standard default sounding reference
  private levels: SoundingLevel[] = [
    { zKm: 0.0, temperatureC: 20.0 },
    { zKm: 1.5, temperatureC: 10.0 },
    { zKm: 3.0, temperatureC: 0.0 },
    { zKm: 4.0, temperatureC: -7.0 },
    { zKm: 5.0, temperatureC: -15.0 },
    { zKm: 6.0, temperatureC: -22.0 },
    { zKm: 8.0, temperatureC: -35.0 },
    { zKm: 10.0, temperatureC: -50.0 },
    { zKm: 12.0, temperatureC: -60.0 },
    { zKm: 14.0, temperatureC: -68.0 },
  ];

  public getTemperature(zKm: number, zFreezingKm: number = 3.0): number {
    // Piecewise temperature profile anchored at zFreezingKm
    if (zKm <= zFreezingKm) {
      // Warm layer below 0°C: linear lapse from surface (20°C) to 0°C at zFreezingKm
      const lapse = 20.0 / Math.max(0.5, zFreezingKm);
      return 20.0 - lapse * zKm;
    } else {
      // Sub-freezing layer: moist adiabatic lapse rate (~6.5 K/km) down to -60°C at 12 km
      const deltaZ = zKm - zFreezingKm;
      const lapseAloft = 60.0 / Math.max(1.0, 12.0 - zFreezingKm);
      return -lapseAloft * deltaZ;
    }
  }

  public getAirDensity(zKm: number): number {
    // Barometric formula: rho = rho0 * exp(-z / H), scale height H ~ 8.5 km
    const rho0 = 1.225; // kg/m^3
    const H = 8.5; // km
    return rho0 * Math.exp(-zKm / H);
  }

  public getIsothermAltitudes(zFreezingKm: number): {
    z0C: number;
    zMinus10C: number;
    zMinus20C: number;
    zMinus30C: number;
    zMinus40C: number;
  } {
    const lapseAloft = 60.0 / Math.max(1.0, 12.0 - zFreezingKm);
    return {
      z0C: zFreezingKm,
      zMinus10C: zFreezingKm + 10.0 / lapseAloft,
      zMinus20C: zFreezingKm + 20.0 / lapseAloft,
      zMinus30C: zFreezingKm + 30.0 / lapseAloft,
      zMinus40C: zFreezingKm + 40.0 / lapseAloft,
    };
  }
}
