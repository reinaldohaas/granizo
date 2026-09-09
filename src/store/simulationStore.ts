import { create } from 'zustand';
import { SimulationParams, GroundHydrometeorStats, ParticleTelemetry, ScenarioPreset } from '../types/simulationTypes';
import { ScenarioFactory } from '../simulation/ScenarioFactory';

interface SimulationState {
  params: SimulationParams;
  isRunning: boolean;
  showTrajectories: boolean;
  showIsotherms: boolean;
  showWindField: boolean;
  showCrossSectionModal: boolean;
  selectedParticleId: number;
  selectedTelemetry: ParticleTelemetry | null;
  groundStats: GroundHydrometeorStats;
  activeScenario: ScenarioPreset;

  // Actions
  setParam: <K extends keyof SimulationParams>(key: K, value: SimulationParams[K]) => void;
  setScenario: (preset: ScenarioPreset) => void;
  setStage: (stage: number) => void;
  toggleRunning: () => void;
  toggleTrajectories: () => void;
  toggleIsotherms: () => void;
  toggleWindField: () => void;
  toggleCrossSectionModal: (open?: boolean) => void;
  selectParticle: (id: number) => void;
  updateTelemetry: (telemetry: ParticleTelemetry | null) => void;
  updateGroundStats: (stats: GroundHydrometeorStats) => void;
  resetSimulation: () => void;
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
    rainCount: 0,
    graupelCount: 0,
    smallHailCount: 0,
    mediumHailCount: 0,
    largeHailCount: 0,
    giantHailCount: 0,
    totalGrounded: 0
  },
  activeScenario: 'supercelula',

  setParam: (key, value) => {
    set((state) => ({
      params: { ...state.params, [key]: value }
    }));
  },

  setScenario: (preset) => {
    const override = ScenarioFactory.getScenario(preset);
    set((state) => ({
      activeScenario: preset,
      params: { ...state.params, ...override }
    }));
  },

  setStage: (stage) => {
    set((state) => ({
      params: { ...state.params, currentStage: stage }
    }));
  },

  toggleRunning: () => set((state) => ({ isRunning: !state.isRunning })),
  toggleTrajectories: () => set((state) => ({ showTrajectories: !state.showTrajectories })),
  toggleIsotherms: () => set((state) => ({ showIsotherms: !state.showIsotherms })),
  toggleWindField: () => set((state) => ({ showWindField: !state.showWindField })),
  toggleCrossSectionModal: (open) => set((state) => ({
    showCrossSectionModal: open !== undefined ? open : !state.showCrossSectionModal
  })),

  selectParticle: (id) => set({ selectedParticleId: id }),
  updateTelemetry: (telemetry) => set({ selectedTelemetry: telemetry }),
  updateGroundStats: (stats) => set({ groundStats: { ...stats } }),
  resetSimulation: () => {
    set({
      groundStats: {
        rainCount: 0,
        graupelCount: 0,
        smallHailCount: 0,
        mediumHailCount: 0,
        largeHailCount: 0,
        giantHailCount: 0,
        totalGrounded: 0
      }
    });
  }
}));
