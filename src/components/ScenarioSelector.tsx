import React from 'react';
import { useSimulationStore } from '../store/simulationStore';
import { ScenarioPreset } from '../types/simulationTypes';

export const ScenarioSelector: React.FC = () => {
  const activeScenario = useSimulationStore((state) => state.activeScenario);
  const setScenario = useSimulationStore((state) => state.setScenario);

  const presets: Array<{ key: ScenarioPreset; name: string; emoji: string; desc: string }> = [
    { key: 'supercelula', name: 'Supercélula (Hail)', emoji: '🔴', desc: 'Updraft violento (48 m/s), SLW abundante e granizo gigante em camadas.' },
    { key: 'forte', name: 'Tempestade Forte', emoji: '🟡', desc: 'Updraft moderado (28 m/s), granizo pequeno e médio.' },
    { key: 'comum', name: 'Tempestade Comum', emoji: '🟢', desc: 'Updraft fraco (12 m/s), chuva e graupel.' },
    { key: 'derretimento_intenso', name: 'Fusão Profunda (Rain)', emoji: '🔥', desc: 'Nível de 0°C a 4,8 km; todo granizo derrete antes do solo.' },
    { key: 'neve_inverno', name: 'Neve (Snow NOAA)', emoji: '❄️', desc: 'Coluna 100% abaixo de 0°C; cristais precipitam como neve.' },
    { key: 'inversao_sleet', name: 'Pelotas de Gelo (Sleet)', emoji: '⚪', desc: 'Inversão térmica com camada quente em altitude e ar frio no solo.' }
  ];

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-xs font-semibold text-slate-400 hidden xl:inline">Cenários NOAA:</span>
      {presets.map((p) => {
        const isActive = activeScenario === p.key;
        return (
          <button
            key={p.key}
            onClick={() => setScenario(p.key)}
            title={p.desc}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition flex items-center gap-1 ${
              isActive
                ? 'border-cyan-400 bg-cyan-950 text-cyan-300 shadow-sm shadow-cyan-500/20'
                : 'border-slate-700 bg-slate-800/80 text-slate-400 hover:text-white hover:border-slate-600'
            }`}
          >
            <span>{p.emoji}</span>
            <span className="hidden sm:inline">{p.name}</span>
          </button>
        );
      })}
    </div>
  );
};
