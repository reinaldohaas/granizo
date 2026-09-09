export enum ParticleType {
  DROP = 0,         // Liquid droplet (T > 0°C)
  SLW_DROP = 1,     // Supercooled liquid water droplet (T <= 0°C)
  ICE_CRYSTAL = 2,  // Ice crystal / snowflake
  GRAUPEL = 3,      // Rime porous ice embryo (2 - 5 mm)
  HAIL = 4,         // Layered severe hailstone (> 5 mm)
  RAIN = 5          // Melted raindrop at ground
}

export enum GrowthRegime {
  NONE = 0,
  DRY = 1,    // Rime growth: fast freezing, opaque white, trapped air bubbles
  WET = 2,    // Glaze growth: liquid surface film, slow freezing, transparent ice
  MELTING = 3 // Below 0°C level: liquid ablation and size reduction
}

export interface LayerRecord {
  thicknessMm: number;
  regime: GrowthRegime;
  temperatureC: number;
  altitudeKm: number;
  timestamp: number;
}

export interface SoundingNode {
  zKm: number;
  tempC: number;
  dewPointC: number;
  label?: string;
}

export interface ParticleTelemetry {
  id: number;
  type: ParticleType;
  xKm: number;
  zKm: number;
  diameterMm: number;
  massG: number;
  vxMs: number;
  vzMs: number;
  terminalVelocityMs: number;
  updraftMs: number;
  temperatureC: number;
  recirculations: number;
  waterCollectedG: number;
  regime: GrowthRegime;
  frozenFraction: number;
  meltedFraction: number;
  layers: number;
  layerHistory: LayerRecord[];
}

export interface SimulationParams {
  wMax: number;             // Maximum updraft speed in m/s (5 to 55)
  updraftWidthKm: number;   // Updraft core width in km (0.8 to 4.0)
  updraftTiltDeg: number;   // Updraft tilt / wind shear effect (0 to 30)
  zFreezingKm: number;      // Altitude of 0°C isotherm (1.5 to 5.0)
  lwcMax: number;           // Supercooled Liquid Water Content in g/m³ (0.5 to 5.0)
  turbulenceIntensity: number; // Simplex noise amplitude (0.0 to 1.0)
  shearStrength: number;    // Vertical wind shear (m/s per km)
  warmLayerDepthKm: number; // Depth of warm air below cloud base
  subCloudHumidity: number; // Relative humidity below 0°C (0.3 to 1.0)
  numParticles: number;     // Active particles in simulation (20 to 150)
  timeScale: number;        // Speed multiplier (0.2 to 3.0)
  randomSeed: number;       // Seed for PRNG reproducibility
  currentStage: number;     // 1 to 4
  soundingNodes: SoundingNode[]; // Interactive NOAA thermodynamic profile
}

export interface GroundHydrometeorStats {
  rainCount: number;
  graupelCount: number;
  smallHailCount: number;   // < 5 mm
  mediumHailCount: number;  // 5 to 20 mm
  largeHailCount: number;   // 20 to 50 mm
  giantHailCount: number;   // > 50 mm
  totalGrounded: number;
}

export type ScenarioPreset = 'comum' | 'forte' | 'supercelula' | 'derretimento_intenso' | 'neve_inverno' | 'inversao_sleet';
