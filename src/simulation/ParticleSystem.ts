import { ParticleType, GrowthRegime, ParticleTelemetry, LayerRecord, ScenarioPreset } from '../types/simulationTypes';
import { HailstonePhysics } from './HailstonePhysics';
import { globalRNG } from './RandomGenerator';

export class ParticleSystem {
  public readonly capacity: number;
  public activeCount: number;

  public positionsX: Float32Array;
  public positionsZ: Float32Array;
  public velocitiesX: Float32Array;
  public velocitiesZ: Float32Array;
  public diameters: Float32Array;
  public masses: Float32Array;
  public types: Uint8Array;
  public regimes: Uint8Array;
  public layers: Uint8Array;
  public recirculations: Uint8Array;
  public waterCollected: Float32Array;
  public frozenFractions: Float32Array;
  public meltedFractions: Float32Array;
  public alive: Uint8Array;
  public prevVz: Float32Array;

  // Track melt progress in thermodynamic mode (0 = fully frozen, 1 = fully liquid)
  public meltProgress: Float32Array;
  // Track refreeze progress in cold layer (0 = fully liquid, 1 = fully frozen sleet)
  public freezeProgress: Float32Array;

  public trajectories: Array<Array<{ x: number; z: number; d: number }>>;
  public layerHistories: Array<LayerRecord[]>;

  constructor(capacity: number = 200) {
    this.capacity = capacity;
    this.activeCount = 0;

    this.positionsX = new Float32Array(capacity);
    this.positionsZ = new Float32Array(capacity);
    this.velocitiesX = new Float32Array(capacity);
    this.velocitiesZ = new Float32Array(capacity);
    this.diameters = new Float32Array(capacity);
    this.masses = new Float32Array(capacity);
    this.types = new Uint8Array(capacity);
    this.regimes = new Uint8Array(capacity);
    this.layers = new Uint8Array(capacity);
    this.recirculations = new Uint8Array(capacity);
    this.waterCollected = new Float32Array(capacity);
    this.frozenFractions = new Float32Array(capacity);
    this.meltedFractions = new Float32Array(capacity);
    this.alive = new Uint8Array(capacity);
    this.prevVz = new Float32Array(capacity);
    this.meltProgress = new Float32Array(capacity);
    this.freezeProgress = new Float32Array(capacity);

    this.trajectories = [];
    this.layerHistories = [];
    for (let i = 0; i < capacity; i++) {
      this.trajectories.push([]);
      this.layerHistories.push([]);
    }
  }

  public init(numParticles: number, isConvective: boolean, scenario?: ScenarioPreset): void {
    this.activeCount = Math.min(numParticles, this.capacity);
    for (let i = 0; i < this.activeCount; i++) {
      this.spawnParticle(i, isConvective, true, scenario);
    }
  }

  public spawnParticle(
    index: number,
    isConvective: boolean,
    isInitial: boolean = false,
    scenario?: ScenarioPreset
  ): void {
    if (!isConvective) {
      // THERMODYNAMIC NOAA MODE: Spawns aloft as SNOWFLAKES falling from stratiform cloud
      this.positionsX[index] = globalRNG.range(2.5, 19.5);
      this.positionsZ[index] = isInitial ? globalRNG.range(1.5, 9.2) : globalRNG.range(7.8, 9.5);
      this.velocitiesX[index] = globalRNG.gaussian(0.2, 0.4); // gentle lateral drift
      this.velocitiesZ[index] = globalRNG.range(-1.8, -2.8); // gentle snowflake fall

      this.types[index] = ParticleType.SNOW;
      const diamMm = globalRNG.range(2.0, 4.0);
      this.diameters[index] = diamMm;
      this.masses[index] = 0.002;
      this.regimes[index] = GrowthRegime.NONE;
      this.layers[index] = 1;
      this.recirculations[index] = 0;
      this.waterCollected[index] = 0;
      this.frozenFractions[index] = 1.0;
      this.meltedFractions[index] = 0.0;
      this.meltProgress[index] = 0.0;
      this.freezeProgress[index] = 0.0;
      this.alive[index] = 1;
      this.prevVz[index] = this.velocitiesZ[index];
    } else if (scenario === 'tempestade_forte') {
      // MULTICELL CONVECTIVE STORM: Line of flank (IV, III), mature core (II) and rain shaft (I)
      if (isInitial) {
        const rand = globalRNG.next();
        if (rand < 0.25) {
          // Cell IV (Flanking line)
          this.positionsX[index] = globalRNG.range(2.8, 4.8);
          this.positionsZ[index] = globalRNG.range(2.2, 5.5);
          this.velocitiesX[index] = globalRNG.range(2.0, 5.0);
          this.velocitiesZ[index] = globalRNG.range(2.0, 6.0);
        } else if (rand < 0.55) {
          // Cell III (Growing Congestus)
          this.positionsX[index] = globalRNG.range(5.8, 8.5);
          this.positionsZ[index] = globalRNG.range(3.0, 9.5);
          this.velocitiesX[index] = globalRNG.range(2.0, 6.0);
          this.velocitiesZ[index] = globalRNG.range(5.0, 14.0);
        } else if (rand < 0.82) {
          // Cell II (Mature peak updraft & 50 dBZ core)
          this.positionsX[index] = globalRNG.range(9.8, 12.5);
          this.positionsZ[index] = globalRNG.range(4.5, 13.5);
          this.velocitiesX[index] = globalRNG.range(1.0, 4.0);
          this.velocitiesZ[index] = globalRNG.range(8.0, 20.0);
        } else {
          // Cell I (Precipitation & downdraft shaft)
          this.positionsX[index] = globalRNG.range(14.2, 17.8);
          this.positionsZ[index] = globalRNG.range(2.0, 8.5);
          this.velocitiesX[index] = globalRNG.range(1.0, 3.0);
          this.velocitiesZ[index] = globalRNG.range(-8.0, -14.0);
        }
      } else {
        // Respawn: Spawns in boundary layer / flanking line feeding into gust front
        this.positionsX[index] = globalRNG.range(2.2, 7.5);
        this.positionsZ[index] = globalRNG.range(1.2, 3.0);
        this.velocitiesX[index] = globalRNG.range(4.0, 8.5);
        this.velocitiesZ[index] = globalRNG.range(1.5, 5.0);
      }
      this.prevVz[index] = this.velocitiesZ[index];

      const type = ParticleType.GRAUPEL;
      const diamMm = globalRNG.range(2.0, 4.0);
      this.types[index] = type;
      this.diameters[index] = diamMm;
      const density = HailstonePhysics.getDensity(diamMm, false);
      this.masses[index] = HailstonePhysics.massFromDiameter(diamMm, density);
      this.regimes[index] = GrowthRegime.DRY;
      this.layers[index] = 1;
      this.recirculations[index] = 0;
      this.waterCollected[index] = 0;
      this.frozenFractions[index] = 1.0;
      this.meltedFractions[index] = 0.0;
      this.meltProgress[index] = 0.0;
      this.freezeProgress[index] = 0.0;
      this.alive[index] = 1;
    } else {
      // CONVECTIVE STORM MODE: Spawns near inflow base as small GRAUPEL embryos
      const xBase = 8.5;
      if (isInitial) {
        this.positionsX[index] = xBase + globalRNG.range(-1.5, 4.0);
        this.positionsZ[index] = globalRNG.range(2.0, 9.5);
      } else {
        this.positionsX[index] = xBase + globalRNG.range(-1.2, 1.5);
        this.positionsZ[index] = globalRNG.range(1.8, 3.8);
      }

      this.velocitiesX[index] = globalRNG.range(0.5, 3.0);
      this.velocitiesZ[index] = globalRNG.range(2.0, 8.0);
      this.prevVz[index] = this.velocitiesZ[index];

      const type = ParticleType.GRAUPEL;
      const diamMm = globalRNG.range(2.0, 3.8);
      this.types[index] = type;
      this.diameters[index] = diamMm;
      const density = HailstonePhysics.getDensity(diamMm, false);
      this.masses[index] = HailstonePhysics.massFromDiameter(diamMm, density);
      this.regimes[index] = GrowthRegime.DRY;
      this.layers[index] = 1;
      this.recirculations[index] = 0;
      this.waterCollected[index] = 0;
      this.frozenFractions[index] = 1.0;
      this.meltedFractions[index] = 0.0;
      this.meltProgress[index] = 0.0;
      this.freezeProgress[index] = 0.0;
      this.alive[index] = 1;
    }

    this.trajectories[index] = [{ x: this.positionsX[index], z: this.positionsZ[index], d: this.diameters[index] }];
    this.layerHistories[index] = [{
      thicknessMm: this.diameters[index],
      regime: GrowthRegime.DRY,
      temperatureC: -15,
      altitudeKm: this.positionsZ[index],
      timestamp: 0
    }];
  }

  public getTelemetry(index: number, T: number, Td: number, w: number, vt: number): ParticleTelemetry | null {
    if (index < 0 || index >= this.activeCount || this.alive[index] === 0) return null;

    return {
      id: index + 1,
      type: this.types[index] as ParticleType,
      xKm: this.positionsX[index],
      zKm: this.positionsZ[index],
      diameterMm: this.diameters[index],
      massG: this.masses[index],
      vxMs: this.velocitiesX[index],
      vzMs: this.velocitiesZ[index],
      terminalVelocityMs: vt,
      updraftMs: w,
      temperatureC: T,
      dewPointC: Td,
      recirculations: this.recirculations[index],
      waterCollectedG: this.waterCollected[index],
      regime: this.regimes[index] as GrowthRegime,
      frozenFraction: this.frozenFractions[index],
      meltedFraction: this.meltedFractions[index],
      layers: this.layers[index],
      layerHistory: [...this.layerHistories[index]]
    };
  }
}
