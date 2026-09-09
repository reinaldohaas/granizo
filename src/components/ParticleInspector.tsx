import React from 'react';
import { useSimulationStore } from '../store/simulationStore';
import { GrowthRegime, ParticleType } from '../types/simulationTypes';
import { Maximize2 } from 'lucide-react';

export const ParticleInspector: React.FC = () => {
  const tel = useSimulationStore((state) => state.selectedTelemetry);
  const toggleModal = useSimulationStore((state) => state.toggleCrossSectionModal);

  if (!tel) {
    return (
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3 text-xs text-slate-400 text-center">
        Clique em qualquer partícula ou hidrometeoro para inspecionar sua microfísica.
      </div>
    );
  }

  const getTypeName = (t: ParticleType) => {
    switch (t) {
      case ParticleType.SNOW: return '❄️ Floco de Neve';
      case ParticleType.MELTING_SNOW: return '💧 Neve Derretendo';
      case ParticleType.RAIN: return '🌧️ Gota de Chuva';
      case ParticleType.SUPERCOOLED_DROP: return '💎 Gota Super-resfriada';
      case ParticleType.SLEET: return '⚪ Pelotas de gelo (sleet)';
      case ParticleType.GRAUPEL: return '🍚 Graupel (Embrião)';
      case ParticleType.HAIL: return '🧊 Granizo em Camadas';
      default: return 'Partícula';
    }
  };

  const regimeName = 
    tel.regime === GrowthRegime.DRY ? 'Crescimento Seco (Rime)' :
    tel.regime === GrowthRegime.WET ? 'Crescimento Úmido (Glaze)' :
    tel.regime === GrowthRegime.MELTING ? 'Derretimento na Camada Quente' : 'Equilíbrio / Queda Livre';

  const regimeColor = 
    tel.regime === GrowthRegime.DRY ? 'text-amber-300' :
    tel.regime === GrowthRegime.WET ? 'text-cyan-400 font-bold' :
    tel.regime === GrowthRegime.MELTING ? 'text-red-400' : 'text-slate-400';

  const canShowCrossSection = tel.type === ParticleType.HAIL || tel.type === ParticleType.GRAUPEL;

  return (
    <div className="bg-slate-900/95 backdrop-blur-md border border-cyan-500/40 rounded-xl p-3 text-xs shadow-xl space-y-2">
      <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping"></span>
          <span className="font-bold text-white text-[11px]">
            {getTypeName(tel.type)} #{tel.id}
          </span>
        </div>
        {canShowCrossSection && (
          <button
            onClick={() => toggleModal(true)}
            className="px-2 py-0.5 rounded bg-cyan-950 border border-cyan-800 text-cyan-300 hover:bg-cyan-900 text-[10px] font-bold flex items-center gap-1 transition"
          >
            <Maximize2 className="w-3 h-3" /> Corte Interno
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-x-3 gap-y-1 font-mono text-[11px]">
        <div><span className="text-slate-400">Diâmetro:</span> <strong className="text-white">{tel.diameterMm.toFixed(1)} mm</strong></div>
        <div><span className="text-slate-400">Massa:</span> <strong className="text-white">{tel.massG.toFixed(2)} g</strong></div>
        <div><span className="text-slate-400">Altitude:</span> <strong className="text-cyan-300">{tel.zKm.toFixed(2)} km</strong></div>
        <div><span className="text-slate-400">Temperatura:</span> <strong className="text-cyan-300">{tel.temperatureC.toFixed(1)} °C</strong></div>
        <div><span className="text-slate-400">v<sub>z</sub> (Queda):</span> <strong className="text-white">{tel.vzMs.toFixed(1)} m/s</strong></div>
        <div><span className="text-slate-400">v<sub>terminal</sub>:</span> <strong className="text-purple-300">{tel.terminalVelocityMs.toFixed(1)} m/s</strong></div>
        {tel.updraftMs !== 0 && (
          <div><span className="text-slate-400">Updraft (w):</span> <strong className="text-cyan-400">{tel.updraftMs.toFixed(1)} m/s</strong></div>
        )}
        {tel.recirculations > 0 && (
          <div><span className="text-slate-400">Recirculações:</span> <strong className="text-amber-300">{tel.recirculations} voltas</strong></div>
        )}
        {tel.meltedFraction !== undefined && tel.meltedFraction > 0 && (
          <div><span className="text-slate-400">Fusão Líquida:</span> <strong className="text-blue-300">{(tel.meltedFraction * 100).toFixed(0)}%</strong></div>
        )}
        {tel.frozenFraction !== undefined && tel.frozenFraction > 0 && (
          <div><span className="text-slate-400">Recongelado:</span> <strong className="text-indigo-300">{(tel.frozenFraction * 100).toFixed(0)}%</strong></div>
        )}
      </div>

      <div className="pt-1.5 border-t border-slate-800/80 flex items-center justify-between text-[11px]">
        <span className="text-slate-400">Estado Físico:</span>
        <span className={regimeColor}>{regimeName}</span>
      </div>
    </div>
  );
};
