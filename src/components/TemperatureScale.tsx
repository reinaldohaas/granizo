import React from 'react';
import { useSimulationStore } from '../store/simulationStore';

export const TemperatureScale: React.FC = () => {
  const zFreezing = useSimulationStore((state) => state.params.zFreezingKm);

  // Key reference levels
  const levels = [
    { z: 12.0, t: '-60 °C', label: 'Topo / Bigorna' },
    { z: 10.0, t: '-50 °C', label: 'Troposfera Superior' },
    { z: 8.8,  t: '-40 °C', label: 'Nucleação Homogênea' },
    { z: 7.0,  t: '-28 °C', label: 'Zona Rime' },
    { z: 5.7,  t: '-20 °C', label: 'Zona Primária de Granizo' },
    { z: 4.4,  t: '-10 °C', label: 'Base de Crescimento' },
    { z: zFreezing, t: '0 °C', label: 'Nível de Congelamento', highlight: true },
    { z: 1.5,  t: '+10 °C', label: 'Base da Nuvem' },
    { z: 0.0,  t: '+20 °C', label: 'Superfície (Solo)' }
  ];

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3 text-xs space-y-2">
      <div className="flex justify-between items-center border-b border-slate-800 pb-1.5">
        <span className="font-bold text-slate-300 text-[11px] uppercase tracking-wider">Perfil Vertical</span>
        <span className="font-mono text-[10px] text-cyan-400">0°C = {zFreezing.toFixed(1)} km</span>
      </div>

      <div className="space-y-1 font-mono text-[11px]">
        {levels.map((lvl, idx) => (
          <div
            key={idx}
            className={`flex items-center justify-between px-1.5 py-0.5 rounded ${
              lvl.highlight ? 'bg-cyan-950/80 border border-cyan-800/80 text-cyan-300 font-bold' : 'text-slate-400'
            }`}
          >
            <span>{lvl.z.toFixed(1)} km</span>
            <span className={lvl.highlight ? 'text-white' : 'text-slate-500'}>{lvl.label}</span>
            <span className={lvl.z < zFreezing ? 'text-amber-400' : 'text-cyan-400'}>{lvl.t}</span>
          </div>
        ))}
      </div>
    </div>
  );
};
