import { SimulationParams, GroundHydrometeorStats, ParticleType, GrowthRegime, ScenarioPreset } from '../types/simulationTypes';
import { AtmosphericProfile } from './AtmosphericProfile';
import { WindField } from './WindField';
import { ParticleSystem } from './ParticleSystem';
import { HailstonePhysics } from './HailstonePhysics';
import { AccretionModel } from './AccretionModel';
import { FreezingModel } from './FreezingModel';
import { MeltingModel } from './MeltingModel';
import { ScenarioFactory } from './ScenarioFactory';
import { globalRNG } from './RandomGenerator';

export class SimulationEngine {
  public params: SimulationParams;
  public atmos: AtmosphericProfile;
  public wind: WindField;
  public particles: ParticleSystem;

  public simTimeSec: number = 0;
  public groundStats: GroundHydrometeorStats;
  public selectedIndex: number = 0;

  public static readonly SPEED_MULTIPLIER = 16.0;
  public static readonly FIXED_DT = 0.03;
  private accumulator: number = 0;

  constructor(initialParams: SimulationParams) {
    this.params = { ...initialParams };
    this.atmos = new AtmosphericProfile();
    this.wind = new WindField();
    this.particles = new ParticleSystem(160);

    this.groundStats = {
      snowCount: 0,
      rainCount: 0,
      sleetCount: 0,
      freezingRainCount: 0,
      glazeIceThicknessMm: 0,
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
    const isConvective = this.params.family === 'convective';
    this.particles.init(this.params.numParticles, isConvective);
    this.selectedIndex = 0;
  }

  /**
   * Mandatory Full Reset whenever the user switches scenario or profile
   */
  public resetScenario(preset: ScenarioPreset): void {
    this.params = ScenarioFactory.createParamsForScenario(preset);
    this.simTimeSec = 0;
    this.accumulator = 0;
    this.selectedIndex = 0;
    this.resetStats();
    this.init();
  }

  public update(dtWallSec: number): void {
    // Continuous accelerated lifecycle for Byers & Braham (1949) ordinary cell
    if (this.params.activeScenario === 'tempestade_comum' && this.params.autoEvolveStorm) {
      const rate = this.params.stormEvolutionRate ?? 1.2;
      const advanceMin = dtWallSec * this.params.timeScale * rate;
      this.params.stormMinutes = (this.params.stormMinutes ?? 0) + advanceMin;
      if (this.params.stormMinutes > 30.5) {
        this.params.stormMinutes = 0.0;
      }
    }

    const effectiveDt = dtWallSec * this.params.timeScale * SimulationEngine.SPEED_MULTIPLIER;
    this.accumulator += effectiveDt;

    const maxSteps = 10;
    let steps = 0;
    while (this.accumulator >= SimulationEngine.FIXED_DT && steps < maxSteps) {
      this.physicsStep(SimulationEngine.FIXED_DT);
      this.accumulator -= SimulationEngine.FIXED_DT;
      steps++;
    }
  }

  private physicsStep(dt: number): void {
    this.simTimeSec += dt;
    const isConvective = this.params.family === 'convective';
    const count = this.particles.activeCount;
    const nodes = this.params.soundingNodes;

    // Detect surface cold layer depth to physically separate sleet and freezing rain
    const diagnosis = this.atmos.classifyPrecipitation(nodes);

    for (let i = 0; i < count; i++) {
      if (this.particles.alive[i] === 0) continue;

      let x = this.particles.positionsX[i];
      let z = this.particles.positionsZ[i];
      let diam = this.particles.diameters[i];
      let mass = this.particles.masses[i];
      let type = this.particles.types[i] as ParticleType;

      const T = this.atmos.getTemperature(z, this.params.zFreezingKm, nodes);
      const Td = this.atmos.getDewPoint(z, nodes);
      const depression = Math.max(0, T - Td);

      if (!isConvective) {
        // ==========================================
        // 1. THERMODYNAMIC NOAA MODE (NO CONVECTIVE UPDRAFTS)
        // ==========================================
        let fallSpeed = 2.2; // Snowflake base fall speed (m/s)

        if (type === ParticleType.MELTING_SNOW) fallSpeed = 4.0;
        else if (type === ParticleType.RAIN || type === ParticleType.SUPERCOOLED_DROP) fallSpeed = 7.5;
        else if (type === ParticleType.SLEET) fallSpeed = 6.0;

        // Dry layer sublimation/evaporation if T - Td is large
        if (depression > 7.0) {
          const evapLoss = 0.03 * (depression - 7.0) * dt;
          diam = Math.max(0, diam - evapLoss);
          if (diam <= 0.4) {
            // Completely evaporated in dry layer (Virga)
            this.particles.alive[i] = 0;
            this.particles.spawnParticle(i, false, false);
            continue;
          }
        }

        // Phase transformation sequence along vertical column:
        if (T <= 0.0) {
          if (this.particles.meltProgress[i] === 0.0) {
            // Cold from top: stays pure SNOW
            type = ParticleType.SNOW;
          } else if (this.particles.meltProgress[i] >= 1.0) {
            // Was completely melted into rain above, now enters subfreezing air below!
            if (diagnosis.type === 'sleet') {
              // Deep cold layer: re-freezes into SLEET (pelota de gelo)
              this.particles.freezeProgress[i] += dt * 0.45;
              if (this.particles.freezeProgress[i] >= 0.8) {
                type = ParticleType.SLEET;
              } else {
                type = ParticleType.SUPERCOOLED_DROP;
              }
            } else {
              // Shallow cold layer: remains SUPERCOOLED DROP (will freeze on ground contact)
              type = ParticleType.SUPERCOOLED_DROP;
            }
          }
        } else {
          // Warm layer (T > 0°C): melting occurs
          const meltRate = (0.25 + T * 0.08) * dt;
          this.particles.meltProgress[i] = Math.min(1.0, this.particles.meltProgress[i] + meltRate);

          if (this.particles.meltProgress[i] < 0.6) {
            type = ParticleType.MELTING_SNOW;
          } else {
            type = ParticleType.RAIN;
          }
        }

        this.particles.types[i] = type;
        this.particles.diameters[i] = diam;

        // Aerodynamic downward motion (downward gravity terminal fall + gentle horizontal drift)
        const vx = this.particles.velocitiesX[i];
        const vz = -fallSpeed;
        this.particles.velocitiesX[i] = vx;
        this.particles.velocitiesZ[i] = vz;

        x += (vx * dt) / 1000.0;
        z += (vz * dt) / 1000.0;
        this.particles.positionsX[i] = x;
        this.particles.positionsZ[i] = z;

        // Trajectory record
        const traj = this.particles.trajectories[i];
        if (traj.length === 0 || Math.hypot(x - traj[traj.length - 1].x, z - traj[traj.length - 1].z) > 0.15) {
          traj.push({ x, z, d: diam });
          if (traj.length > 80) traj.shift();
        }

        // Surface Arrival (z <= 0 km)
        if (z <= 0.0) {
          this.particles.positionsZ[i] = 0;
          this.particles.alive[i] = 0;
          this.groundStats.totalGrounded++;

          if (type === ParticleType.SNOW) {
            this.groundStats.snowCount++;
          } else if (type === ParticleType.RAIN || type === ParticleType.MELTING_SNOW) {
            this.groundStats.rainCount++;
          } else if (type === ParticleType.SLEET) {
            this.groundStats.sleetCount++;
          } else if (type === ParticleType.SUPERCOOLED_DROP) {
            // Freezes upon contact with surface! Accumulates ice glaze film
            this.groundStats.freezingRainCount++;
            this.groundStats.glazeIceThicknessMm = Math.min(25.0, this.groundStats.glazeIceThicknessMm + 0.12);
          }

          const respawnIdx = i;
          setTimeout(() => {
            this.particles.spawnParticle(respawnIdx, false, false);
          }, 100 + Math.random() * 300);
        }

        if (x < 1.0 || x > 21.0) {
          this.particles.spawnParticle(i, false, false);
        }

      } else {
        // ==========================================
        // 2. CONVECTIVE STORM MODE (HAIL DYNAMICS)
        // ==========================================
        const rhoAir = this.atmos.getAirDensity(z);
        const isGlaze = this.particles.regimes[i] === GrowthRegime.WET;
        const rhoHail = HailstonePhysics.getDensity(diam, isGlaze);

        const { u: uAir, w: wAir } = this.wind.evaluate(x, z, this.simTimeSec, this.params);

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

        // Recirculation loop detection
        const prevVz = this.particles.prevVz[i];
        if (prevVz < -0.5 && nextVz > 1.0 && z > 2.5 && z < 9.0) {
          this.particles.recirculations[i]++;
          this.particles.layers[i]++;
          const regime = FreezingModel.evaluateRegime(T, 0.05, diam, Math.abs(nextVz - wAir));
          this.particles.layerHistories[i].push({
            thicknessMm: diam,
            regime,
            temperatureC: T,
            altitudeKm: z,
            timestamp: this.simTimeSec
          });
        }
        this.particles.prevVz[i] = nextVz;

        this.particles.velocitiesX[i] = nextVx;
        this.particles.velocitiesZ[i] = nextVz;

        x += (nextVx * dt) / 1000.0;
        z += (nextVz * dt) / 1000.0;
        this.particles.positionsX[i] = x;
        this.particles.positionsZ[i] = z;

        const traj = this.particles.trajectories[i];
        if (traj.length === 0 || Math.hypot(x - traj[traj.length - 1].x, z - traj[traj.length - 1].z) > 0.12) {
          traj.push({ x, z, d: diam });
          if (traj.length > 120) traj.shift();
        }

        // Accretion growth in supercooled water zone (-40°C < T < 0°C)
        if (T <= 0.0 && T >= -40.0) {
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

            const history = this.particles.layerHistories[i];
            const lastLayer = history[history.length - 1];
            if (!lastLayer || (lastLayer.regime !== regime && diam - lastLayer.thicknessMm > 1.8)) {
              this.particles.layers[i]++;
              history.push({
                thicknessMm: diam,
                regime,
                temperatureC: T,
                altitudeKm: z,
                timestamp: this.simTimeSec
              });
            }
          }
        }

        // Melting below Freezing Level (T > 0°C)
        if (T > 0.0) {
          this.particles.regimes[i] = GrowthRegime.MELTING;
          const insideDowndraft = this.wind.isInsideDowndraft(x, z);

          if (insideDowndraft) {
            // Inside Downdraft: fast transit + chilled air -> minimal melting, arrives intact as hail
            const dMelt = MeltingModel.calculateMeltingRate(Math.min(5.0, T * 0.35), diam, Math.abs(nextVz), 0.95);
            mass = Math.max(0.01, mass - dMelt * dt * 0.4);
            diam = HailstonePhysics.diameterFromMass(mass, rhoHail);
          } else {
            // Outside Downdraft: slow descent in warm air -> melts progressively into rain
            const dMelt = MeltingModel.calculateMeltingRate(T, diam, Math.abs(nextVz), this.params.subCloudHumidity);
            mass = Math.max(0.001, mass - dMelt * dt * 1.8);
            diam = HailstonePhysics.diameterFromMass(mass, rhoHail);

            if (diam <= 2.5 || mass <= 0.015) {
              type = ParticleType.RAIN;
              this.particles.types[i] = type;
            }
          }
        }

        this.particles.diameters[i] = diam;
        this.particles.masses[i] = mass;

        // Surface Impact (z <= 0 km)
        if (z <= 0.0) {
          this.particles.positionsZ[i] = 0;
          this.particles.alive[i] = 0;
          this.groundStats.totalGrounded++;

          if (type === ParticleType.RAIN || diam <= 2.5) {
            this.groundStats.rainCount++;
          } else if (diam < 5.0) {
            this.groundStats.graupelCount++;
          } else if (diam < 15.0) {
            this.groundStats.smallHailCount++;
          } else if (diam < 35.0) {
            this.groundStats.mediumHailCount++;
          } else if (diam < 55.0) {
            this.groundStats.largeHailCount++;
          } else {
            this.groundStats.giantHailCount++;
          }

          const respawnIdx = i;
          setTimeout(() => {
            this.particles.spawnParticle(respawnIdx, true, false);
          }, 150 + Math.random() * 400);
        }

        if (x < 0.5 || x > 22.0 || z > 14.0) {
          this.particles.spawnParticle(i, true, false);
        }
      }
    }
  }

  public resetStats(): void {
    this.groundStats = {
      snowCount: 0,
      rainCount: 0,
      sleetCount: 0,
      freezingRainCount: 0,
      glazeIceThicknessMm: 0,
      graupelCount: 0,
      smallHailCount: 0,
      mediumHailCount: 0,
      largeHailCount: 0,
      giantHailCount: 0,
      totalGrounded: 0
    };
  }
}
