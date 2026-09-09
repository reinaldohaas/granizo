import { SimulationParams, ScenarioPreset } from '../types/simulationTypes';
import { AtmosphericProfile } from './AtmosphericProfile';

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
      currentStage: 4,
      soundingNodes: [...AtmosphericProfile.defaultSoundingNodes]
    };
  }

  public static getScenario(preset: ScenarioPreset): Partial<SimulationParams> {
    switch (preset) {
      case 'comum':
        return {
          wMax: 12.0,
          updraftWidthKm: 1.4,
          updraftTiltDeg: 3.0,
          zFreezingKm: 3.2,
          lwcMax: 1.4,
          shearStrength: 0.8,
          currentStage: 2,
          numParticles: 25,
          soundingNodes: [
            { zKm: 0.0, tempC: 22.0, dewPointC: 18.0, label: 'Superfície' },
            { zKm: 1.5, tempC: 12.0, dewPointC: 11.0, label: 'Base' },
            { zKm: 3.2, tempC: 0.0, dewPointC: -2.0, label: '0°C' },
            { zKm: 6.0, tempC: -18.0, dewPointC: -22.0, label: '-18°C' },
            { zKm: 9.0, tempC: -38.0, dewPointC: -42.0, label: '-38°C' },
            { zKm: 12.0, tempC: -58.0, dewPointC: -64.0, label: 'Topo' }
          ]
        };

      case 'forte':
        return {
          wMax: 28.0,
          updraftWidthKm: 2.0,
          updraftTiltDeg: 8.0,
          zFreezingKm: 2.8,
          lwcMax: 2.6,
          shearStrength: 1.6,
          currentStage: 3,
          numParticles: 32,
          soundingNodes: [
            { zKm: 0.0, tempC: 24.0, dewPointC: 19.0, label: 'Superfície' },
            { zKm: 1.5, tempC: 11.0, dewPointC: 10.0, label: 'Base' },
            { zKm: 2.8, tempC: 0.0, dewPointC: -1.0, label: '0°C' },
            { zKm: 5.5, tempC: -19.0, dewPointC: -21.0, label: '-19°C' },
            { zKm: 8.5, tempC: -40.0, dewPointC: -45.0, label: '-40°C' },
            { zKm: 12.0, tempC: -62.0, dewPointC: -68.0, label: 'Topo' }
          ]
        };

      case 'supercelula':
        return {
          wMax: 48.0,
          updraftWidthKm: 2.8,
          updraftTiltDeg: 18.0,
          zFreezingKm: 3.0,
          lwcMax: 4.2,
          shearStrength: 3.2,
          currentStage: 4,
          numParticles: 45,
          soundingNodes: [...AtmosphericProfile.defaultSoundingNodes]
        };

      case 'derretimento_intenso':
        return {
          wMax: 32.0,
          updraftWidthKm: 2.0,
          updraftTiltDeg: 10.0,
          zFreezingKm: 4.8, // Deep warm melting layer
          lwcMax: 2.8,
          currentStage: 4,
          numParticles: 35,
          soundingNodes: [
            { zKm: 0.0, tempC: 32.0, dewPointC: 24.0, label: 'Superfície Quente' },
            { zKm: 2.0, tempC: 18.0, dewPointC: 15.0, label: 'Baixa Troposfera' },
            { zKm: 4.8, tempC: 0.0, dewPointC: -3.0, label: '0°C Elevado' },
            { zKm: 7.5, tempC: -18.0, dewPointC: -24.0, label: '-18°C' },
            { zKm: 10.0, tempC: -38.0, dewPointC: -46.0, label: '-38°C' },
            { zKm: 13.0, tempC: -62.0, dewPointC: -70.0, label: 'Topo' }
          ]
        };

      case 'neve_inverno':
        return {
          wMax: 10.0,
          updraftWidthKm: 1.5,
          updraftTiltDeg: 4.0,
          zFreezingKm: 0.0, // Entire column freezing
          lwcMax: 0.8,
          shearStrength: 1.0,
          currentStage: 3,
          numParticles: 30,
          soundingNodes: [
            { zKm: 0.0, tempC: -2.0, dewPointC: -4.0, label: 'Superfície Gelada' },
            { zKm: 1.5, tempC: -6.0, dewPointC: -7.0, label: 'Base' },
            { zKm: 3.0, tempC: -14.0, dewPointC: -16.0, label: '-14°C' },
            { zKm: 6.0, tempC: -30.0, dewPointC: -34.0, label: '-30°C' },
            { zKm: 9.0, tempC: -48.0, dewPointC: -52.0, label: '-48°C' },
            { zKm: 12.0, tempC: -65.0, dewPointC: -70.0, label: 'Topo' }
          ]
        };

      case 'inversao_sleet':
        return {
          wMax: 14.0,
          updraftWidthKm: 1.6,
          updraftTiltDeg: 5.0,
          zFreezingKm: 1.2,
          lwcMax: 1.2,
          shearStrength: 1.5,
          currentStage: 3,
          numParticles: 30,
          soundingNodes: [
            { zKm: 0.0, tempC: -3.0, dewPointC: -4.0, label: 'Ar Frio Solo' },
            { zKm: 1.2, tempC: 0.0, dewPointC: -1.0, label: 'Inversão 0°C' },
            { zKm: 2.2, tempC: 4.0, dewPointC: 3.0, label: 'Camada Quente' },
            { zKm: 3.4, tempC: 0.0, dewPointC: -2.0, label: '0°C Superior' },
            { zKm: 6.5, tempC: -18.0, dewPointC: -24.0, label: '-18°C' },
            { zKm: 11.0, tempC: -55.0, dewPointC: -60.0, label: 'Topo' }
          ]
        };
    }
  }
}
