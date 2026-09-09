import React from 'react';
import { useSimulationStore } from '../store/simulationStore';
import { ScenarioPreset } from '../types/simulationTypes';

export const ScenarioSelector: React.FC = () => {
  const activeScenario = useSimulationStore((state) => state.activeScenario);
  const setScenario = useSimulationStore((state) => state.setScenario);

  const thermodynamicPresets: Array<{ key: ScenarioPreset; name: string; emoji: string; desc: string }> = [
    { key: 'neve', name: 'Neve', emoji: '❄️', desc: 'Coluna 100% fria (T < 0°C). Flocos caem intactos até a superfície.' },
    { key: 'chuva', name: 'Chuva', emoji: '🌧️', desc: 'Camada de fusão profunda. Neve derrete completamente e atinge o solo como líquido.' },
    { key: 'sleet', name: 'Pelotas de gelo (sleet)', emoji: '🍚', desc: 'Neve derrete em nariz quente e recongela em camada fria profunda (>= 1.2 km).' },
    { key: 'chuva_congelante', name: 'Chuva congelante', emoji: '⛸️', desc: 'Neve derrete em camada quente e atinge o solo em camada fria rasa (< 1.0 km), congelando no solo.' }
  ];

  const convectivePresets: Array<{ key: ScenarioPreset; name: string; emoji: string; desc: string }> = [
    { key: 'tempestade_comum', name: 'Tempestade Comum', emoji: '🟢', desc: 'Ciclo clássico Byers & Braham (1949): cumulus, maduro com downdraft e dissipação em 30 min.' },
    { key: 'tempestade_forte', name: 'Tempestade Forte (Multicelular)', emoji: '🟡', desc: 'Multicelular com linha de flanco (estágios IV, III, II, I), frente de rajada e núcleos 10, 30, 50 dBZ.' },
    { key: 'supercelula', name: 'Supercélula', emoji: '🔴', desc: 'Updraft violento (48 m/s), núcleo inclinado e granizo gigante (> 5 cm).' }
  ];

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* NOAA Thermodynamic Group */}
      <div className="flex items-center gap-1 bg-slate-900/90 p-1 rounded-xl border border-blue-900/40">
        <span className="text-[10px] uppercase font-bold text-blue-400 px-1.5 hidden 2xl:inline">
          NOAA NESDIS:
        </span>
        {thermodynamicPresets.map((p) => {
          const isActive = activeScenario === p.key;
          return (
            <button
              key={p.key}
              onClick={() => setScenario(p.key)}
              title={p.desc}
              className={`px-2 py-1 rounded-lg text-xs font-semibold border transition flex items-center gap-1 ${
                isActive
                  ? 'border-blue-400 bg-blue-950 text-blue-200 shadow-md shadow-blue-500/20'
                  : 'border-transparent bg-slate-800/60 text-slate-400 hover:text-white hover:border-slate-700'
              }`}
            >
              <span>{p.emoji}</span>
              <span className="hidden sm:inline">{p.name}</span>
            </button>
          );
        })}
      </div>

      {/* Convective Group */}
      <div className="flex items-center gap-1 bg-slate-900/90 p-1 rounded-xl border border-amber-900/40">
        <span className="text-[10px] uppercase font-bold text-amber-400 px-1.5 hidden 2xl:inline">
          Tempestade:
        </span>
        {convectivePresets.map((p) => {
          const isActive = activeScenario === p.key;
          return (
            <button
              key={p.key}
              onClick={() => setScenario(p.key)}
              title={p.desc}
              className={`px-2 py-1 rounded-lg text-xs font-semibold border transition flex items-center gap-1 ${
                isActive
                  ? 'border-amber-400 bg-amber-950 text-amber-200 shadow-md shadow-amber-500/20'
                  : 'border-transparent bg-slate-800/60 text-slate-400 hover:text-white hover:border-slate-700'
              }`}
            >
              <span>{p.emoji}</span>
              <span className="hidden sm:inline">{p.name}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
