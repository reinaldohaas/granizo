import { HailstonePhysics } from './HailstonePhysics';

export class MeltingModel {
  /**
   * Calculates mass loss rate by melting in warm layer (T > 0°C) in g/s
   */
  public static calculateMeltingRate(
    temperatureC: number,
    diameterMm: number,
    fallSpeedMs: number,
    subCloudHumidity: number = 0.8
  ): number {
    if (temperatureC <= 0 || diameterMm <= 0) return 0;

    const Dm = diameterMm / 1000.0;
    const Ka = 0.025; // Thermal conductivity of air (W/m K)
    const deltaT = temperatureC; // degrees above 0°C

    // Ventilation factor for falling stone
    const Re = (1.2 * Math.abs(fallSpeedMs) * Dm) / 1.8e-5;
    const fVent = 1.0 + 0.28 * Math.sqrt(Math.max(1.0, Re));

    // Convective sensible heat flux: Q = 2 * pi * D * Ka * deltaT * fVent (Watts)
    // Latent heat contribution from evaporation/condensation modulated by humidity
    const qSensibleWatts = 2.0 * Math.PI * Dm * Ka * deltaT * fVent;
    const humidityFactor = 1.0 + (1.0 - subCloudHumidity) * 0.5; // dry air cools stone by evaporation

    const totalHeatWatts = qSensibleWatts / humidityFactor;

    // Melting rate: dm/dt = Q / Lf (kg/s)
    const dmKgS = totalHeatWatts / HailstonePhysics.LF;

    return dmKgS * 1000.0; // g/s
  }
}
