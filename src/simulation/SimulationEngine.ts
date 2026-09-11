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
  private lastRecordedStormMin: number = 0;

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
    this.particles.init(this.params.numParticles, isConvective, this.params.activeScenario, this.params.snowflakeSizeMm);
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
    if (this.params.activeScenario === 'tempestade_comum') {
      const prevMin = this.params.stormMinutes ?? 0;
      if (this.params.autoEvolveStorm) {
        const rate = this.params.stormEvolutionRate ?? 1.2;
        const advanceMin = dtWallSec * this.params.timeScale * rate;
        let nextMin = prevMin + advanceMin;
        if (nextMin > 30.5) {
          nextMin = 0.0;
          // When cycling back to 0 min, reset to 0 particles
          for (let j = 0; j < this.particles.capacity; j++) {
            this.particles.alive[j] = 0;
            this.particles.trajectories[j] = [];
          }
        }
        this.params.stormMinutes = nextMin;
      }

      const curMin = this.params.stormMinutes ?? 0;
      // If user moved scrubber or clicked a jump button (delta > 0.75 min)
      if (Math.abs(curMin - this.lastRecordedStormMin) > 0.75) {
        this.syncOrdinaryStormState(curMin);
      } else {
        this.updateOrdinaryStormEvolution(curMin);
      }
      this.lastRecordedStormMin = curMin;
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
            if (this.params.raindropSizeMm) {
              diam = this.params.raindropSizeMm * 0.95;
            }
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
            const rateInc = (this.params.glazeAccretionRateMmH ?? 1.8) * 0.04;
            this.groundStats.glazeIceThicknessMm = Math.min(30.0, this.groundStats.glazeIceThicknessMm + rateInc);
          }

          const respawnIdx = i;
          setTimeout(() => {
            this.particles.spawnParticle(respawnIdx, false, false, undefined, this.params.snowflakeSizeMm);
          }, 100 + Math.random() * 300);
        }

        if (x < 1.0 || x > 21.0) {
          this.particles.spawnParticle(i, false, false, undefined, this.params.snowflakeSizeMm);
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
          const insideDowndraft = this.wind.isInsideDowndraft(x, z, this.params.activeScenario);

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
          if (this.params.activeScenario === 'tempestade_comum') {
            const tMin = this.params.stormMinutes ?? 0;
            // Only respawn during growth stage (t < 18 min); in dissipation (t >= 18 min), particles DIE permanently
            if (tMin >= 2.5 && tMin < 18.0) {
              setTimeout(() => {
                if (this.params.activeScenario === 'tempestade_comum' && (this.params.stormMinutes ?? 0) < 18.0) {
                  this.particles.spawnParticle(respawnIdx, true, false, this.params.activeScenario);
                }
              }, 200 + Math.random() * 300);
            }
          } else {
            setTimeout(() => {
              this.particles.spawnParticle(respawnIdx, true, false, this.params.activeScenario);
            }, 150 + Math.random() * 400);
          }
        }

        if (x < 0.5 || x > 22.0 || z > 15.6) {
          if (this.params.activeScenario === 'tempestade_comum') {
            const tMin = this.params.stormMinutes ?? 0;
            if (tMin >= 2.5 && tMin < 18.0) {
              this.particles.spawnParticle(i, true, false, this.params.activeScenario);
            } else {
              this.particles.alive[i] = 0;
            }
          } else {
            this.particles.spawnParticle(i, true, false, this.params.activeScenario);
          }
        }
      }
    }
  }

  public updateOrdinaryStormEvolution(tMin: number): void {
    const Nmax = Math.min(this.params.numParticles, this.particles.capacity);

    if (tMin < 2.5) {
      // Stage 0 (0 to 2.5 min): Exactly 0 active particles (cloud in early condensation)
      for (let j = 0; j < this.particles.capacity; j++) {
        this.particles.alive[j] = 0;
      }
      return;
    }

    if (tMin < 18.0) {
      // Stage 1 & 2 (2.5 to 18 min): Cumulus & Congestus growth
      // Target active particles ramps up linearly from 1 to Nmax
      const targetCount = Math.max(1, Math.min(Nmax, Math.round(((tMin - 2.5) / 15.5) * Nmax)));

      let aliveCount = 0;
      for (let j = 0; j < Nmax; j++) {
        if (this.particles.alive[j]) aliveCount++;
      }

      // If currently alive < targetCount, spawn new embryos in the ascending core
      if (aliveCount < targetCount) {
        for (let j = 0; j < Nmax && aliveCount < targetCount; j++) {
          if (this.particles.alive[j] === 0) {
            this.particles.spawnParticle(j, true, false, 'tempestade_comum');
            aliveCount++;
          }
        }
      }
      return;
    }

    if (tMin <= 21.0) {
      // Stage 3 (18 to 21 min): Peak Mature Stage (All particles active)
      let aliveCount = 0;
      for (let j = 0; j < Nmax; j++) {
        if (this.particles.alive[j]) aliveCount++;
      }
      if (aliveCount < Nmax && tMin < 19.5) {
        for (let j = 0; j < Nmax && aliveCount < Nmax; j++) {
          if (this.particles.alive[j] === 0) {
            this.particles.spawnParticle(j, true, false, 'tempestade_comum');
            aliveCount++;
          }
        }
      }
      return;
    }

    // Stage 4 & 5 (21 to 30 min): Dissipation & Falling of particles with cloud
    // NO new particles spawn! Existing particles fall in downdraft and die on ground impact.
    // Near complete dissipation (tMin >= 29.2), clean any residual floating particles to finish at 0.
    if (tMin >= 29.2) {
      for (let j = 0; j < this.particles.capacity; j++) {
        this.particles.alive[j] = 0;
      }
    }
  }

  public syncOrdinaryStormState(targetMin: number): void {
    if (this.params.activeScenario !== 'tempestade_comum') return;
    this.lastRecordedStormMin = targetMin;

    const Nmax = Math.min(this.params.numParticles, this.particles.capacity);
    const zFz = this.params.zFreezingKm;

    if (targetMin < 2.5) {
      // 0 to 2.5 min -> EXACTLY ZERO ACTIVE PARTICLES
      for (let i = 0; i < this.particles.capacity; i++) {
        this.particles.alive[i] = 0;
        this.particles.trajectories[i] = [];
      }
      return;
    }

    if (targetMin < 18.0) {
      // 2.5 to 18 min -> Formation and Growth
      const targetCount = Math.max(1, Math.min(Nmax, Math.round(((targetMin - 2.5) / 15.5) * Nmax)));
      const zTop = 4.0 + (targetMin <= 10.0 ? (targetMin / 10.0) * 2.2 : 2.2 + ((targetMin - 10.0) / 5.0) * 2.8);

      for (let i = 0; i < this.particles.capacity; i++) {
        if (i < targetCount) {
          this.particles.alive[i] = 1;
          const frac = i / Math.max(1, targetCount);
          const z = 2.8 + frac * Math.max(1.0, zTop - 3.4);
          this.particles.positionsX[i] = 9.0 + (globalRNG.next() - 0.5) * 1.8;
          this.particles.positionsZ[i] = z;
          this.particles.velocitiesX[i] = (globalRNG.next() - 0.5) * 1.5;
          this.particles.velocitiesZ[i] = 4.0 + frac * 7.0; // rising in updraft
          this.particles.prevVz[i] = this.particles.velocitiesZ[i];

          const diam = 2.0 + frac * (2.0 + (targetMin / 18.0) * 7.0);
          this.particles.diameters[i] = diam;
          const density = HailstonePhysics.getDensity(diam, false);
          this.particles.masses[i] = HailstonePhysics.massFromDiameter(diam, density);
          this.particles.types[i] = diam >= 5.0 ? ParticleType.HAIL : ParticleType.GRAUPEL;
          this.particles.regimes[i] = GrowthRegime.DRY;
          this.particles.trajectories[i] = [{ x: this.particles.positionsX[i], z, d: diam }];
        } else {
          this.particles.alive[i] = 0;
          this.particles.trajectories[i] = [];
        }
      }
      return;
    }

    if (targetMin <= 21.0) {
      // 18 to 21 min -> Peak Mature Stage (All particles active, peak hail size near top)
      for (let i = 0; i < this.particles.capacity; i++) {
        if (i < Nmax) {
          this.particles.alive[i] = 1;
          const frac = i / Nmax;
          const z = 5.2 + frac * 5.2; // 5.2 to 10.4 km
          this.particles.positionsX[i] = 9.0 + (globalRNG.next() - 0.5) * 2.2;
          this.particles.positionsZ[i] = z;
          this.particles.velocitiesX[i] = (globalRNG.next() - 0.5) * 2.0;
          this.particles.velocitiesZ[i] = z > 8.5 ? 2.0 - frac * 4.0 : -3.5;
          this.particles.prevVz[i] = this.particles.velocitiesZ[i];

          const diam = 8.0 + (globalRNG.next() * 0.4 + frac * 0.6) * 22.0;
          this.particles.diameters[i] = diam;
          const density = HailstonePhysics.getDensity(diam, true);
          this.particles.masses[i] = HailstonePhysics.massFromDiameter(diam, density);
          this.particles.types[i] = ParticleType.HAIL;
          this.particles.regimes[i] = GrowthRegime.WET;
          this.particles.layers[i] = 3;
          this.particles.trajectories[i] = [{ x: this.particles.positionsX[i], z, d: diam }];
        } else {
          this.particles.alive[i] = 0;
          this.particles.trajectories[i] = [];
        }
      }
      return;
    }

    // 21 to 30 min -> Falling with the Cloud and Depleting into Dissipation
    const dissipProgress = (targetMin - 21.0) / 8.5; // 0 to 1
    const targetCount = Math.max(0, Math.round(Nmax * (1.0 - dissipProgress)));

    for (let i = 0; i < this.particles.capacity; i++) {
      if (i < targetCount && dissipProgress < 0.95) {
        this.particles.alive[i] = 1;
        const maxZ = Math.max(0.8, 8.5 * (1.0 - dissipProgress));
        const z = 0.3 + (i / Math.max(1, targetCount)) * maxZ;
        this.particles.positionsX[i] = 9.0 + (globalRNG.next() - 0.5) * 2.0;
        this.particles.positionsZ[i] = z;
        this.particles.velocitiesX[i] = (globalRNG.next() - 0.5) * 1.5;
        this.particles.velocitiesZ[i] = -12.0 - globalRNG.next() * 6.0; // Plunging down with downdraft!
        this.particles.prevVz[i] = this.particles.velocitiesZ[i];

        const isBelowFz = z < zFz;
        const diam = isBelowFz ? Math.max(2.0, 15.0 * (z / zFz)) : 16.0;
        this.particles.diameters[i] = diam;
        this.particles.types[i] = (isBelowFz && diam < 4.0) ? ParticleType.RAIN : ParticleType.HAIL;
        this.particles.regimes[i] = isBelowFz ? GrowthRegime.MELTING : GrowthRegime.WET;
        this.particles.trajectories[i] = [{ x: this.particles.positionsX[i], z, d: diam }];
      } else {
        this.particles.alive[i] = 0;
        this.particles.trajectories[i] = [];
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
