import { create } from 'zustand';
import { SimulationFamily, SimulationParams, GroundHydrometeorStats, ParticleTelemetry, ScenarioPreset, SoundingNode } from '../types/simulationTypes';
import { ScenarioFactory } from '../simulation/ScenarioFactory';
import { AtmosphericProfile } from '../simulation/AtmosphericProfile';

interface SimulationState {
  params: SimulationParams;
  simulationFamily: SimulationFamily;
  isRunning: boolean;
  showTrajectories: boolean;
  showIsotherms: boolean;
  showWindField: boolean;
  showCrossSectionModal: boolean;
  selectedParticleId: number;
  selectedTelemetry: ParticleTelemetry | null;
  groundStats: GroundHydrometeorStats;
  activeScenario: ScenarioPreset;
  resetEpoch: number; // Incremented on mandatory reset to force immediate engine rebuild

  // Actions
  setParam: <K extends keyof SimulationParams>(key: K, value: SimulationParams[K]) => void;
  setScenario: (preset: ScenarioPreset) => void;
  setSoundingNode: (index: number, tempC: number, dewPointC: number, zKm?: number) => void;
  setStage: (stage: number) => void;
  setStormMinutes: (min: number) => void;
  toggleAutoEvolveStorm: () => void;
  setStormEvolutionRate: (rate: number) => void;
  toggleRunning: () => void;
  toggleTrajectories: () => void;
  toggleIsotherms: () => void;
  toggleWindField: () => void;
  toggleCrossSectionModal: (open?: boolean) => void;
  selectParticle: (id: number) => void;
  updateTelemetry: (telemetry: ParticleTelemetry | null) => void;
  updateGroundStats: (stats: GroundHydrometeorStats) => void;
  resetSimulation: () => void;
  resetCurrentScenarioToDefault: () => void;
  setSurfaceTemp: (tempC: number) => void;
  setWarmNoseTemp: (tempC: number) => void;
  setColdLayerDepth: (depthKm: number) => void;
  setFreezingLevelHeight: (heightKm: number) => void;
}

export const useSimulationStore = create<SimulationState>((set, get) => ({
  params: ScenarioFactory.createDefaultParams(),
  isRunning: true,
  showTrajectories: true,
  showIsotherms: true,
  showWindField: true,
  showCrossSectionModal: false,
  selectedParticleId: 1,
  selectedTelemetry: null,
  groundStats: {
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
  },
  activeScenario: 'supercelula',
  simulationFamily: 'convective',
  resetEpoch: 0,

  setParam: (key, value) => {
    set((state) => ({
      params: { ...state.params, [key]: value }
    }));
  },

  setStage: (stage) => {
    set((state) => ({
      params: { ...state.params, currentStage: stage }
    }));
  },

  setStormMinutes: (min) => {
    set((state) => ({
      params: { ...state.params, stormMinutes: Math.max(0, Math.min(30, min)) }
    }));
  },

  toggleAutoEvolveStorm: () => {
    set((state) => ({
      params: { ...state.params, autoEvolveStorm: !state.params.autoEvolveStorm }
    }));
  },

  setStormEvolutionRate: (rate) => {
    set((state) => ({
      params: { ...state.params, stormEvolutionRate: rate }
    }));
  },

  // Mandatory complete reset when changing scenario
  setScenario: (preset) => {
    const newParams = ScenarioFactory.createParamsForScenario(preset);
    set((state) => ({
      activeScenario: preset,
      simulationFamily: newParams.family,
      params: newParams,
      selectedParticleId: 1,
      selectedTelemetry: null,
      resetEpoch: state.resetEpoch + 1,
      groundStats: {
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
      }
    }));
  },

  setSoundingNode: (index, tempC, dewPointC, zKm) => {
    set((state) => {
      const updatedNodes = [...state.params.soundingNodes];
      if (index >= 0 && index < updatedNodes.length) {
        // Enforce Td <= T strictly
        const validTd = Math.min(tempC, dewPointC);
        updatedNodes[index] = {
          ...updatedNodes[index],
          tempC,
          dewPointC: validTd,
          zKm: zKm !== undefined ? zKm : updatedNodes[index].zKm
        };
      }

      const atmos = new AtmosphericProfile();
      const zFz = atmos.getFreezingLevel(updatedNodes, state.params.zFreezingKm);
      return {
        params: {
          ...state.params,
          soundingNodes: updatedNodes,
          zFreezingKm: zFz
        }
      };
    });
  },

  toggleRunning: () => set((state) => ({ isRunning: !state.isRunning })),
  toggleTrajectories: () => set((state) => ({ showTrajectories: !state.showTrajectories })),
  toggleIsotherms: () => set((state) => ({ showIsotherms: !state.showIsotherms })),
  toggleWindField: () => set((state) => ({ showWindField: !state.showWindField })),
  toggleCrossSectionModal: (open) =>
    set((state) => ({
      showCrossSectionModal: open !== undefined ? open : !state.showCrossSectionModal
    })),
  selectParticle: (id) => set(() => ({ selectedParticleId: id })),
  updateTelemetry: (telemetry) => set(() => ({ selectedTelemetry: telemetry })),
  updateGroundStats: (stats) => set(() => ({ groundStats: { ...stats } })),

  resetSimulation: () => {
    const currentPreset = get().activeScenario;
    get().setScenario(currentPreset);
  },

  resetCurrentScenarioToDefault: () => {
    const currentPreset = get().activeScenario;
    get().setScenario(currentPreset);
  },

  setSurfaceTemp: (tempC: number) => {
    const nodes = get().params.soundingNodes;
    if (nodes.length > 0) {
      const curTd = nodes[0].dewPointC;
      const validTd = Math.min(tempC, curTd);
      get().setSoundingNode(0, tempC, validTd);
    }
  },

  setWarmNoseTemp: (tempC: number) => {
    const nodes = get().params.soundingNodes;
    // In Sleet/Freezing Rain, node 2 (index 2) is the warm nose aloft
    if (nodes.length > 2) {
      const curTd = nodes[2].dewPointC;
      const validTd = Math.min(tempC, curTd);
      get().setSoundingNode(2, tempC, validTd);
      get().setParam('warmNoseTempC', tempC);
    }
  },

  setColdLayerDepth: (depthKm: number) => {
    const nodes = get().params.soundingNodes;
    // Node 1 (index 1) marks the top of the cold surface layer
    if (nodes.length > 1) {
      get().setSoundingNode(1, nodes[1].tempC, nodes[1].dewPointC, depthKm);
      get().setParam('coldLayerDepthKm', depthKm);
    }
  },

  setFreezingLevelHeight: (heightKm: number) => {
    get().setParam('zFreezingKm', heightKm);
  }
}));
