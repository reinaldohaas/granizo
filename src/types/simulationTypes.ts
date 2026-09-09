export type SimulationFamily = 'thermodynamic' | 'convective';

export type ScenarioPreset =
  // NOAA NESDIS Thermodynamic Modes
  | 'neve'
  | 'chuva'
  | 'sleet'
  | 'chuva_congelante'
  // Convective Severe Storm Modes
  | 'tempestade_comum'
  | 'tempestade_forte'
  | 'supercelula';

export enum ParticleType {
  // Thermodynamic NOAA Family
  SNOW = 0,             // Snowflake / Ice crystal
  MELTING_SNOW = 1,     // Slushy melting snowflake
  RAIN = 2,             // Liquid raindrop
  SUPERCOOLED_DROP = 3, // Liquid droplet below 0°C (Freezing rain)
  SLEET = 4,            // Re-frozen translucent ice pellet
  // Convective Storm Family
  GRAUPEL = 5,          // Convective rime porous embryo
  HAIL = 6              // Severe layered hailstone
}

export enum GrowthRegime {
  NONE = 0,
  DRY = 1,     // Rime growth: opaque white, trapped air bubbles
  WET = 2,     // Glaze growth: clear translucent ice
  MELTING = 3  // Liquid ablation
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
  dewPointC: number; // Strictly enforced Td <= T
  label: string;
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
  dewPointC: number;
  recirculations: number;
  waterCollectedG: number;
  regime: GrowthRegime;
  frozenFraction: number;
  meltedFraction: number;
  layers: number;
  layerHistory: LayerRecord[];
}

export interface SimulationParams {
  family: SimulationFamily;
  activeScenario: ScenarioPreset;
  // Convective storm parameters
  wMax: number;             // Updraft speed in m/s (5 to 55)
  updraftWidthKm: number;   // Updraft core width in km (0.8 to 4.0)
  updraftTiltDeg: number;   // Updraft tilt (0 to 30)
  zFreezingKm: number;      // 0°C isotherm altitude (calculated or preset)
  lwcMax: number;           // Supercooled Liquid Water Content in g/m³
  turbulenceIntensity: number; // Simplex noise amplitude
  shearStrength: number;    // Vertical wind shear
  subCloudHumidity: number; // Relative humidity (0.1 to 1.0)
  numParticles: number;     // Active particles (20 to 120)
  timeScale: number;        // Speed multiplier (0.5 to 3.0)
  randomSeed: number;       // PRNG seed
  currentStage: number;     // 1 to 4
  // Exactly 4 NOAA Sounding Levels
  soundingNodes: SoundingNode[];
}

export interface GroundHydrometeorStats {
  // Thermodynamic stats
  snowCount: number;
  rainCount: number;
  sleetCount: number;
  freezingRainCount: number;
  glazeIceThicknessMm: number; // Ice accretion from freezing rain
  // Convective hail stats
  graupelCount: number;
  smallHailCount: number;   // < 15 mm
  mediumHailCount: number;  // 15 to 30 mm
  largeHailCount: number;   // 30 to 50 mm
  giantHailCount: number;   // > 50 mm
  totalGrounded: number;
}
