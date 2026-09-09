import React from 'react';
import { useSimulationStore } from '../store/simulationStore';
import { ScenarioPreset } from '../types/simulationTypes';

export const ScenarioSelector: React.FC = () => {
  const activeScenario = useSimulationStore((state) => state.activeScenario);
  const setScenario = useSimulationStore((state) => state.setScenario);

  const presets: Array<{ key: ScenarioPreset; name: string; emoji: string; desc: string }> = [
    { key: 'comum', name: 'Tempestade Comum', emoji: '🟢', desc: 'Updraft fraco (12 m/s), predominantemente chuva e pequeno graupel.' },
    { key: 'forte', name: 'Tempestade Forte', emoji: '🟡', desc: 'Updraft moderado (26 m/s), granizo pequeno e médio.' },
    { key: 'supercelula', name: 'Supercélula Severa', emoji: '🔴', desc: 'Updraft violento e inclinado (48 m/s), SLW abundante e granizo gigante.' },
    { key: 'derretimento_intenso', name: 'Derretimento Intenso', emoji: '🔥', desc: 'Nível de 0°C a 4,8 km; forte fusão térmica antes da superfície.' },
  ];

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs font-semibold text-slate-400 hidden lg:inline">Cenários:</span>
      {presets.map((p) => {
        const isActive = activeScenario === p.key;
        return (
          <button
            key={p.key}
            onClick={() => setScenario(p.key)}
            title={p.desc}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition flex items-center gap-1.5 ${
              isActive
                ? 'border-cyan-400 bg-cyan-950/80 text-cyan-300 shadow-sm shadow-cyan-500/20'
                : 'border-slate-700 bg-slate-800/90 text-slate-400 hover:text-white hover:border-slate-600'
            }`}
          >
            <span>{p.emoji}</span>
            <span>{p.name}</span>
          </button>
        );
      })}
    </div>
  );
};
