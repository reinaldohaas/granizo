import { ParticleType, GrowthRegime, ParticleTelemetry, LayerRecord } from '../types/simulationTypes';
import { HailstonePhysics } from './HailstonePhysics';
import { globalRNG } from './RandomGenerator';

export class ParticleSystem {
  public readonly capacity: number;
  public activeCount: number;

  // High-performance flat typed arrays as required
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

  // Trajectory history buffer: array of coordinates for each particle
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

    this.trajectories = [];
    this.layerHistories = [];
    for (let i = 0; i < capacity; i++) {
      this.trajectories.push([]);
      this.layerHistories.push([]);
    }
  }

  public init(numParticles: number, zFreezingKm: number, currentStage: number): void {
    this.activeCount = Math.min(numParticles, this.capacity);

    for (let i = 0; i < this.activeCount; i++) {
      this.spawnParticle(i, zFreezingKm, currentStage, true);
    }
  }

  public spawnParticle(
    index: number,
    zFreezingKm: number,
    currentStage: number,
    isInitial: boolean = false
  ): void {
    const xBase = 10.0;
    // Initial random distribution inside convective cloud column
    this.positionsX[index] = xBase + globalRNG.gaussian(0, 2.0);
    this.positionsZ[index] = isInitial ? globalRNG.range(1.5, 9.5) : globalRNG.range(1.5, 3.5);

    this.velocitiesX[index] = globalRNG.gaussian(0, 0.5);
    this.velocitiesZ[index] = globalRNG.range(0.5, 3.0);

    const z = this.positionsZ[index];

    // Determine initial type based on altitude and stage
    let type = ParticleType.DROP;
    let diamMm = globalRNG.range(1.0, 2.5);

    if (currentStage === 1) {
      if (z < zFreezingKm) type = ParticleType.DROP;
      else if (z < 7.0) type = ParticleType.SLW_DROP;
      else type = ParticleType.ICE_CRYSTAL;
    } else if (currentStage === 2) {
      if (z < zFreezingKm) type = ParticleType.DROP;
      else if (z < 9.0) type = ParticleType.SLW_DROP;
      else type = ParticleType.ICE_CRYSTAL;
    } else {
      // Stages 3 and 4: graupel embryos
      if (z > zFreezingKm && z < 8.0 && globalRNG.next() < 0.45) {
        type = ParticleType.GRAUPEL;
        diamMm = globalRNG.range(2.5, 4.5);
      } else if (z >= zFreezingKm) {
        type = ParticleType.SLW_DROP;
      }
    }

    this.types[index] = type;
    this.diameters[index] = diamMm;
    const density = HailstonePhysics.getDensity(diamMm, false);
    this.masses[index] = HailstonePhysics.massFromDiameter(diamMm, density);
    this.regimes[index] = GrowthRegime.NONE;
    this.layers[index] = 1;
    this.recirculations[index] = 0;
    this.waterCollected[index] = 0;
    this.frozenFractions[index] = type === ParticleType.DROP || type === ParticleType.SLW_DROP ? 0 : 1;
    this.meltedFractions[index] = 0;
    this.alive[index] = 1;

    this.trajectories[index] = [{ x: this.positionsX[index], z: this.positionsZ[index], d: diamMm }];
    this.layerHistories[index] = [{
      thicknessMm: diamMm,
      regime: GrowthRegime.DRY,
      temperatureC: -10,
      altitudeKm: z,
      timestamp: 0
    }];
  }

  public getTelemetry(index: number, T: number, w: number, vt: number): ParticleTelemetry | null {
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
