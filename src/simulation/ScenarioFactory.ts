import { SimulationParams, ScenarioPreset } from '../types/simulationTypes';

export class ScenarioFactory {
  public static createDefaultParams(): SimulationParams {
    return {
      wMax: 38.0,
      updraftWidthKm: 2.2,
      updraftTiltDeg: 12.0,
      zFreezingKm: 3.0,
      lwcMax: 3.2,
      turbulenceIntensity: 0.45,
      shearStrength: 2.2,
      warmLayerDepthKm: 3.0,
      subCloudHumidity: 0.8,
      numParticles: 35,
      timeScale: 1.0,
      randomSeed: 1337,
      currentStage: 4
    };
  }

  public static getScenario(preset: ScenarioPreset): Partial<SimulationParams> {
    switch (preset) {
      case 'comum':
        return {
          wMax: 12.0,
          updraftWidthKm: 1.4,
          updraftTiltDeg: 3.0,
          lwcMax: 1.4,
          shearStrength: 0.8,
          currentStage: 2,
          numParticles: 25
        };

      case 'forte':
        return {
          wMax: 26.0,
          updraftWidthKm: 2.0,
          updraftTiltDeg: 8.0,
          lwcMax: 2.5,
          shearStrength: 1.6,
          currentStage: 3,
          numParticles: 32
        };

      case 'supercelula':
        return {
          wMax: 48.0,
          updraftWidthKm: 2.8,
          updraftTiltDeg: 18.0,
          lwcMax: 4.2,
          shearStrength: 3.2,
          currentStage: 4,
          numParticles: 45
        };

      case 'derretimento_intenso':
        return {
          wMax: 32.0,
          updraftWidthKm: 2.0,
          updraftTiltDeg: 10.0,
          zFreezingKm: 4.8, // extremely high 0°C level (deep warm layer)
          lwcMax: 2.8,
          currentStage: 4,
          numParticles: 35
        };
    }
  }
}
