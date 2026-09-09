import React, { useState } from 'react';
import { AtmosphericSounding } from './AtmosphericSounding';
import { useSimulationStore } from '../store/simulationStore';
import { ChevronDown, ChevronUp } from 'lucide-react';

export const TemperatureScale: React.FC = () => {
  const [showSoundingGraph, setShowSoundingGraph] = useState(true);
  const zFreezing = useSimulationStore((state) => state.params.zFreezingKm);
  const soundingNodes = useSimulationStore((state) => state.params.soundingNodes);

  return (
    <div className="space-y-3">
      {/* Interactive NOAA Sounding */}
      {showSoundingGraph && <AtmosphericSounding />}

      {/* Collapsible Altitude Level Table */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3 text-xs space-y-2">
        <div className="flex justify-between items-center border-b border-slate-800 pb-1.5">
          <span className="font-bold text-slate-300 text-[11px] uppercase tracking-wider">
            Níveis de Referência
          </span>
          <button
            onClick={() => setShowSoundingGraph(!showSoundingGraph)}
            className="text-[10px] text-cyan-400 hover:underline flex items-center gap-0.5"
          >
            {showSoundingGraph ? <><ChevronUp className="w-3 h-3" /> Ocultar Gráfico</> : <><ChevronDown className="w-3 h-3" /> Ver Gráfico NOAA</>}
          </button>
        </div>

        <div className="space-y-1 font-mono text-[11px]">
          {soundingNodes.map((lvl, idx) => (
            <div
              key={idx}
              className={`flex items-center justify-between px-1.5 py-0.5 rounded ${
                lvl.tempC === 0 ? 'bg-cyan-950/80 border border-cyan-800/80 text-cyan-300 font-bold' : 'text-slate-400'
              }`}
            >
              <span>{lvl.zKm.toFixed(1)} km</span>
              <span className="text-slate-500">{lvl.label || `Cota ${lvl.zKm}km`}</span>
              <span className={lvl.tempC < 0 ? 'text-cyan-400' : 'text-amber-400'}>
                T: {lvl.tempC.toFixed(0)}°C
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
