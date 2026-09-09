import { SimulationParams, GroundHydrometeorStats, ParticleType, GrowthRegime } from '../types/simulationTypes';
import { AtmosphericProfile } from './AtmosphericProfile';
import { WindField } from './WindField';
import { ParticleSystem } from './ParticleSystem';
import { HailstonePhysics } from './HailstonePhysics';
import { AccretionModel } from './AccretionModel';
import { FreezingModel } from './FreezingModel';
import { MeltingModel } from './MeltingModel';
import { globalRNG } from './RandomGenerator';

export class SimulationEngine {
  public params: SimulationParams;
  public atmos: AtmosphericProfile;
  public wind: WindField;
  public particles: ParticleSystem;

  public simTimeSec: number = 0;
  public groundStats: GroundHydrometeorStats;
  public selectedIndex: number = 0;

  public static readonly FIXED_DT = 0.03;
  private accumulator: number = 0;

  constructor(initialParams: SimulationParams) {
    this.params = { ...initialParams };
    this.atmos = new AtmosphericProfile();
    this.wind = new WindField();
    this.particles = new ParticleSystem(160);

    this.groundStats = {
      rainCount: 0,
      graupelCount: 0,
      smallHailCount: 0,
      mediumHailCount: 0,
      largeHailCount: 0,
      giantHailCount: 0,
      totalGrounded: 0
    };

    this.init();
  }

  public init(): void {
    globalRNG.setSeed(this.params.randomSeed);
    this.wind.reseed();
    this.particles.init(this.params.numParticles, this.params.zFreezingKm, this.params.currentStage);
    this.selectedIndex = 0;
  }

  public update(dtWallSec: number): void {
    this.accumulator += dtWallSec * this.params.timeScale;

    const maxSteps = 8;
    let steps = 0;
    while (this.accumulator >= SimulationEngine.FIXED_DT && steps < maxSteps) {
      this.physicsStep(SimulationEngine.FIXED_DT);
      this.accumulator -= SimulationEngine.FIXED_DT;
      steps++;
    }
  }

  private physicsStep(dt: number): void {
    this.simTimeSec += dt;
    const count = this.particles.activeCount;
    const nodes = this.params.soundingNodes;

    for (let i = 0; i < count; i++) {
      if (this.particles.alive[i] === 0) continue;

      let x = this.particles.positionsX[i];
      let z = this.particles.positionsZ[i];
      let diam = this.particles.diameters[i];
      let mass = this.particles.masses[i];
      let type = this.particles.types[i] as ParticleType;

      const T = this.atmos.getTemperature(z, this.params.zFreezingKm, nodes);
      const rhoAir = this.atmos.getAirDensity(z);
      const isGlaze = this.particles.regimes[i] === GrowthRegime.WET;
      const rhoHail = HailstonePhysics.getDensity(diam, isGlaze);

      // 1. Evaluate Wind Field and Terminal Velocity
      const { u: uAir, w: wAir } = this.wind.evaluate(x, z, this.simTimeSec, this.params);
      const vt = HailstonePhysics.calculateTerminalVelocity(diam, rhoAir, rhoHail);

      // 2. Aerodynamic Motion Integration
      const { vx: nextVx, vz: nextVz } = HailstonePhysics.updateVelocity(
        this.particles.velocitiesX[i],
        this.particles.velocitiesZ[i],
        uAir,
        wAir,
        diam,
        rhoAir,
        rhoHail,
        dt
      );

      this.particles.velocitiesX[i] = nextVx;
      this.particles.velocitiesZ[i] = nextVz;

      x += (nextVx * dt) / 1000.0;
      z += (nextVz * dt) / 1000.0;
      this.particles.positionsX[i] = x;
      this.particles.positionsZ[i] = z;

      const traj = this.particles.trajectories[i];
      if (traj.length === 0 || Math.hypot(x - traj[traj.length - 1].x, z - traj[traj.length - 1].z) > 0.15) {
        traj.push({ x, z, d: diam });
        if (traj.length > 100) traj.shift();
      }

      // 3. Microphysical Transitions
      if (this.params.currentStage >= 3 && type === ParticleType.SLW_DROP && T < -8.0) {
        if (globalRNG.next() < 0.015) {
          type = ParticleType.GRAUPEL;
          this.particles.types[i] = type;
          diam = Math.max(3.0, diam);
        }
      }

      // 4. Growth by Accretion in Supercooled Liquid Water Zone (T < 0°C & T > -40°C)
      if (this.params.currentStage >= 3 && T <= 0.0 && T >= -40.0 && (type === ParticleType.GRAUPEL || type === ParticleType.HAIL)) {
        const lwc = this.wind.getLWC(x, z, this.params, T);
        const vRel = Math.hypot(nextVx - uAir, nextVz - wAir);

        const dmDtGPerS = AccretionModel.calculateAccretionRate(diam, lwc, vRel);
        const deltaMassG = dmDtGPerS * dt;

        if (deltaMassG > 0) {
          mass += deltaMassG;
          this.particles.waterCollected[i] += deltaMassG;

          const regime = FreezingModel.evaluateRegime(T, dmDtGPerS, diam, vRel);
          this.particles.regimes[i] = regime;

          const currentDensity = HailstonePhysics.getDensity(diam, regime === GrowthRegime.WET);
          diam = HailstonePhysics.diameterFromMass(mass, currentDensity);

          if (diam >= 5.0 && type !== ParticleType.HAIL) {
            type = ParticleType.HAIL;
            this.particles.types[i] = type;
          }

          const lastLayer = this.particles.layerHistories[i][this.particles.layerHistories[i].length - 1];
          if (!lastLayer || (lastLayer.regime !== regime && diam - lastLayer.thicknessMm > 2.0)) {
            this.particles.layers[i]++;
            this.particles.recirculations[i]++;
            this.particles.layerHistories[i].push({
              thicknessMm: diam,
              regime,
              temperatureC: T,
              altitudeKm: z,
              timestamp: this.simTimeSec
            });
          }
        }
      }

      // 5. Melting below Freezing Level (T > 0°C)
      if (T > 0.0) {
        this.particles.regimes[i] = GrowthRegime.MELTING;
        const fallSpeed = Math.abs(nextVz);
        const dMeltGPerS = MeltingModel.calculateMeltingRate(T, diam, fallSpeed, this.params.subCloudHumidity);
        const meltLossG = dMeltGPerS * dt;

        mass = Math.max(0.001, mass - meltLossG);
        diam = HailstonePhysics.diameterFromMass(mass, rhoHail);

        if (diam <= 1.2 || mass <= 0.005) {
          type = ParticleType.RAIN;
          this.particles.types[i] = type;
        }
      }

      this.particles.diameters[i] = diam;
      this.particles.masses[i] = mass;

      // 6. Surface Impact (z <= 0 km)
      if (z <= 0.0) {
        this.particles.positionsZ[i] = 0;
        this.particles.alive[i] = 0;

        this.groundStats.totalGrounded++;
        if (type === ParticleType.RAIN || diam <= 1.5) {
          this.groundStats.rainCount++;
        } else if (diam < 5.0) {
          this.groundStats.graupelCount++;
        } else if (diam < 20.0) {
          this.groundStats.smallHailCount++;
        } else if (diam < 50.0) {
          this.groundStats.mediumHailCount++;
        } else {
          this.groundStats.giantHailCount++;
        }

        const respawnIndex = i;
        setTimeout(() => {
          this.particles.spawnParticle(respawnIndex, this.params.zFreezingKm, this.params.currentStage, false);
        }, 600 + Math.random() * 1200);
      }

      if (x < 1.0 || x > 22.0 || z > 14.0) {
        this.particles.spawnParticle(i, this.params.zFreezingKm, this.params.currentStage, false);
      }
    }
  }

  public resetStats(): void {
    this.groundStats = {
      rainCount: 0,
      graupelCount: 0,
      smallHailCount: 0,
      mediumHailCount: 0,
      largeHailCount: 0,
      giantHailCount: 0,
      totalGrounded: 0
    };
  }
}
