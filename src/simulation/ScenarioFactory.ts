import { SimulationParams, ScenarioPreset, SoundingNode } from '../types/simulationTypes';
import { AtmosphericProfile } from './AtmosphericProfile';

export class ScenarioFactory {
  /**
   * Exactly 4 NOAA levels for each preset scenario
   */
  public static getSoundingForScenario(preset: ScenarioPreset): SoundingNode[] {
    switch (preset) {
      case 'neve':
        return [
          { zKm: 0.0, tempC: -3.0, dewPointC: -4.5, label: 'Nível 1 - Superfície (0 km)' },
          { zKm: 2.0, tempC: -7.0, dewPointC: -8.0, label: 'Nível 2 - Baixa Troposfera (2.0 km)' },
          { zKm: 5.5, tempC: -19.0, dewPointC: -21.0, label: 'Nível 3 - Média Troposfera (5.5 km)' },
          { zKm: 9.0, tempC: -38.0, dewPointC: -41.0, label: 'Nível 4 - Alta Troposfera (9.0 km)' }
        ];

      case 'chuva':
        return [
          { zKm: 0.0, tempC: 15.0, dewPointC: 13.0, label: 'Nível 1 - Superfície (0 km)' },
          { zKm: 2.5, tempC: 6.0, dewPointC: 4.5, label: 'Nível 2 - Baixa Troposfera (2.5 km)' },
          { zKm: 5.0, tempC: -10.0, dewPointC: -12.0, label: 'Nível 3 - Média Troposfera (5.0 km)' },
          { zKm: 9.0, tempC: -32.0, dewPointC: -35.0, label: 'Nível 4 - Alta Troposfera (9.0 km)' }
        ];

      case 'sleet':
        // Warm nose aloft (+4°C at 4.5 km), then DEEP cold layer (1.8 km) below freezing
        return [
          { zKm: 0.0, tempC: -4.0, dewPointC: -5.5, label: 'Nível 1 - Superfície Fria (0 km)' },
          { zKm: 1.8, tempC: -5.0, dewPointC: -6.5, label: 'Nível 2 - Camada Fria Profunda (1.8 km)' },
          { zKm: 4.5, tempC: 5.0, dewPointC: 3.5, label: 'Nível 3 - Camada Quente de Fusão (4.5 km)' },
          { zKm: 9.0, tempC: -28.0, dewPointC: -31.0, label: 'Nível 4 - Topo da Nuvem (9.0 km)' }
        ];

      case 'chuva_congelante':
        // Deep warm layer aloft (+6°C at 4 km), then SHALLOW cold layer (< 0.9 km)
        return [
          { zKm: 0.0, tempC: -2.5, dewPointC: -3.5, label: 'Nível 1 - Superfície Subzero (0 km)' },
          { zKm: 0.8, tempC: -1.0, dewPointC: -2.0, label: 'Nível 2 - Camada Fria Rasa (0.8 km)' },
          { zKm: 4.0, tempC: 7.0, dewPointC: 5.5, label: 'Nível 3 - Camada Quente Profunda (4.0 km)' },
          { zKm: 9.0, tempC: -26.0, dewPointC: -29.0, label: 'Nível 4 - Topo da Nuvem (9.0 km)' }
        ];

      case 'tempestade_comum':
        return [
          { zKm: 0.0, tempC: 22.0, dewPointC: 18.0, label: 'Nível 1 - Superfície (0 km)' },
          { zKm: 2.0, tempC: 9.0, dewPointC: 7.5, label: 'Nível 2 - Base Convectiva (2.0 km)' },
          { zKm: 5.5, tempC: -14.0, dewPointC: -16.5, label: 'Nível 3 - Núcleo Térmico (5.5 km)' },
          { zKm: 10.0, tempC: -45.0, dewPointC: -50.0, label: 'Nível 4 - Topo da Nuvem (10.0 km)' }
        ];

      case 'tempestade_forte':
        return [
          { zKm: 0.0, tempC: 25.0, dewPointC: 20.0, label: 'Nível 1 - Superfície Quente (0 km)' },
          { zKm: 2.2, tempC: 11.0, dewPointC: 9.5, label: 'Nível 2 - Nível LCL (2.2 km)' },
          { zKm: 6.0, tempC: -18.0, dewPointC: -21.0, label: 'Nível 3 - Zona de Granizo (6.0 km)' },
          { zKm: 11.5, tempC: -55.0, dewPointC: -62.0, label: 'Nível 4 - Topo Bigorna (11.5 km)' }
        ];

      case 'supercelula':
      default:
        return [
          { zKm: 0.0, tempC: 28.0, dewPointC: 23.0, label: 'Nível 1 - Superfície Úmida (0 km)' },
          { zKm: 2.5, tempC: 13.0, dewPointC: 11.0, label: 'Nível 2 - Influxo Severo (2.5 km)' },
          { zKm: 6.5, tempC: -20.0, dewPointC: -24.0, label: 'Nível 3 - Zona Super-resfriada (6.5 km)' },
          { zKm: 12.5, tempC: -65.0, dewPointC: -72.0, label: 'Nível 4 - Overshooting Top (12.5 km)' }
        ];
    }
  }

  public static createDefaultParams(): SimulationParams {
    return this.createParamsForScenario('supercelula');
  }

  public static createParamsForScenario(preset: ScenarioPreset): SimulationParams {
    const isConvective = preset === 'tempestade_comum' || preset === 'tempestade_forte' || preset === 'supercelula';
    const nodes = this.getSoundingForScenario(preset);
    const atmos = new AtmosphericProfile();
    const zFz = atmos.getFreezingLevel(nodes, 3.0);

    if (!isConvective) {
      // Thermodynamic Stratiform NOAA Mode
      return {
        family: 'thermodynamic',
        activeScenario: preset,
        wMax: 0.0,               // No convective updraft
        updraftWidthKm: 0.0,
        updraftTiltDeg: 0.0,
        zFreezingKm: zFz,
        lwcMax: 0.0,
        turbulenceIntensity: 0.15,
        shearStrength: 0.3,
        subCloudHumidity: 0.85,
        numParticles: 45,
        timeScale: 1.0,
        randomSeed: 1337,
        currentStage: 1,
        soundingNodes: nodes
      };
    } else {
      // Convective Severe Hail Storm Mode
      let wMax = 42.0;
      let width = 2.4;
      let tilt = 14.0;
      let lwc = 3.6;
      let shear = 2.6;
      let particles = 40;

      if (preset === 'tempestade_comum') {
        wMax = 18.0;
        width = 1.6;
        tilt = 4.0;
        lwc = 1.6;
        shear = 1.0;
        particles = 30;
      } else if (preset === 'tempestade_forte') {
        wMax = 32.0;
        width = 2.2;
        tilt = 9.0;
        lwc = 2.6;
        shear = 1.8;
        particles = 36;
      }

      return {
        family: 'convective',
        activeScenario: preset,
        wMax,
        updraftWidthKm: width,
        updraftTiltDeg: tilt,
        zFreezingKm: zFz,
        lwcMax: lwc,
        turbulenceIntensity: 0.4,
        shearStrength: shear,
        subCloudHumidity: 0.8,
        numParticles: particles,
        timeScale: 1.0,
        randomSeed: 1337,
        currentStage: 4,
        soundingNodes: nodes
      };
    }
  }
}
