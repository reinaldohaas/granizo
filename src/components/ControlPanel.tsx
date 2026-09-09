import React from 'react';
import { useSimulationStore } from '../store/simulationStore';
import { Play, Pause, RotateCcw, Wind, Eye, Layers } from 'lucide-react';

export const ControlPanel: React.FC = () => {
  const {
    params,
    isRunning,
    showTrajectories,
    showIsotherms,
    showWindField,
    setParam,
    toggleRunning,
    toggleTrajectories,
    toggleIsotherms,
    toggleWindField,
    resetSimulation
  } = useSimulationStore();

  return (
    <div className="bg-slate-900/95 backdrop-blur-md border border-slate-800 rounded-2xl p-4 shadow-xl space-y-4 text-xs">
      
      {/* Header & Quick Action Buttons */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <h3 className="font-bold text-white uppercase tracking-wider flex items-center gap-1.5 text-xs">
          <span>⚙️</span> Controles e Parâmetros
        </h3>
        
        <div className="flex items-center gap-2">
          <button
            onClick={toggleRunning}
            className={`px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 text-xs transition shadow ${
              isRunning ? 'bg-amber-600 hover:bg-amber-500 text-white' : 'bg-emerald-600 hover:bg-emerald-500 text-white'
            }`}
          >
            {isRunning ? <><Pause className="w-3.5 h-3.5" /> Pausar</> : <><Play className="w-3.5 h-3.5" /> Iniciar</>}
          </button>

          <button
            onClick={resetSimulation}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700"
            title="Reiniciar Simulação"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Layer Toggles */}
      <div className="grid grid-cols-3 gap-2">
        <button
          onClick={toggleTrajectories}
          className={`py-1.5 px-2 rounded-lg text-[11px] font-semibold border transition flex items-center justify-center gap-1 ${
            showTrajectories ? 'bg-cyan-950 border-cyan-700 text-cyan-300' : 'bg-slate-800 border-slate-700 text-slate-400'
          }`}
        >
          <Eye className="w-3 h-3" /> Trajetórias
        </button>

        <button
          onClick={toggleIsotherms}
          className={`py-1.5 px-2 rounded-lg text-[11px] font-semibold border transition flex items-center justify-center gap-1 ${
            showIsotherms ? 'bg-cyan-950 border-cyan-700 text-cyan-300' : 'bg-slate-800 border-slate-700 text-slate-400'
          }`}
        >
          <Layers className="w-3 h-3" /> Isotermas
        </button>

        <button
          onClick={toggleWindField}
          className={`py-1.5 px-2 rounded-lg text-[11px] font-semibold border transition flex items-center justify-center gap-1 ${
            showWindField ? 'bg-cyan-950 border-cyan-700 text-cyan-300' : 'bg-slate-800 border-slate-700 text-slate-400'
          }`}
        >
          <Wind className="w-3 h-3" /> Vento
        </button>
      </div>

      {/* Interactive Sliders */}
      <div className="space-y-3 pt-1">
        
        {/* wMax */}
        <div className="space-y-1">
          <div className="flex justify-between text-xs">
            <span className="text-slate-300">Updraft Máximo (w<sub>max</sub>):</span>
            <strong className="text-cyan-400 font-mono">{params.wMax.toFixed(0)} m/s</strong>
          </div>
          <input
            type="range"
            min="5"
            max="55"
            step="1"
            value={params.wMax}
            onChange={(e) => setParam('wMax', parseFloat(e.target.value))}
            className="w-full h-1.5 bg-slate-800 rounded-lg cursor-pointer"
          />
        </div>

        {/* zFreezing */}
        <div className="space-y-1">
          <div className="flex justify-between text-xs">
            <span className="text-slate-300">Nível de 0 °C (Altitude):</span>
            <strong className="text-cyan-400 font-mono">{params.zFreezingKm.toFixed(1)} km</strong>
          </div>
          <input
            type="range"
            min="1.5"
            max="5.0"
            step="0.1"
            value={params.zFreezingKm}
            onChange={(e) => setParam('zFreezingKm', parseFloat(e.target.value))}
            className="w-full h-1.5 bg-slate-800 rounded-lg cursor-pointer"
          />
        </div>

        {/* LWC */}
        <div className="space-y-1">
          <div className="flex justify-between text-xs">
            <span className="text-slate-300">Água Super-resfriada (LWC):</span>
            <strong className="text-cyan-400 font-mono">{params.lwcMax.toFixed(1)} g/m³</strong>
          </div>
          <input
            type="range"
            min="0.5"
            max="5.0"
            step="0.1"
            value={params.lwcMax}
            onChange={(e) => setParam('lwcMax', parseFloat(e.target.value))}
            className="w-full h-1.5 bg-slate-800 rounded-lg cursor-pointer"
          />
        </div>

        {/* Updraft Width */}
        <div className="space-y-1">
          <div className="flex justify-between text-xs">
            <span className="text-slate-300">Largura do Núcleo:</span>
            <strong className="text-cyan-400 font-mono">{params.updraftWidthKm.toFixed(1)} km</strong>
          </div>
          <input
            type="range"
            min="0.8"
            max="4.0"
            step="0.2"
            value={params.updraftWidthKm}
            onChange={(e) => setParam('updraftWidthKm', parseFloat(e.target.value))}
            className="w-full h-1.5 bg-slate-800 rounded-lg cursor-pointer"
          />
        </div>

        {/* Tilt / Shear */}
        <div className="space-y-1">
          <div className="flex justify-between text-xs">
            <span className="text-slate-300">Inclinação / Cisalhamento:</span>
            <strong className="text-cyan-400 font-mono">{params.updraftTiltDeg.toFixed(0)}°</strong>
          </div>
          <input
            type="range"
            min="0"
            max="25"
            step="1"
            value={params.updraftTiltDeg}
            onChange={(e) => setParam('updraftTiltDeg', parseFloat(e.target.value))}
            className="w-full h-1.5 bg-slate-800 rounded-lg cursor-pointer"
          />
        </div>

        {/* Number of Particles */}
        <div className="space-y-1">
          <div className="flex justify-between text-xs">
            <span className="text-slate-300">Partículas Ativas:</span>
            <strong className="text-cyan-400 font-mono">{params.numParticles}</strong>
          </div>
          <input
            type="range"
            min="15"
            max="70"
            step="5"
            value={params.numParticles}
            onChange={(e) => setParam('numParticles', parseInt(e.target.value))}
            className="w-full h-1.5 bg-slate-800 rounded-lg cursor-pointer"
          />
        </div>

        {/* Speed Multiplier */}
        <div className="space-y-1">
          <div className="flex justify-between text-xs">
            <span className="text-slate-300">Velocidade da Animação:</span>
            <strong className="text-cyan-400 font-mono">{params.timeScale.toFixed(1)}x</strong>
          </div>
          <input
            type="range"
            min="0.2"
            max="2.5"
            step="0.1"
            value={params.timeScale}
            onChange={(e) => setParam('timeScale', parseFloat(e.target.value))}
            className="w-full h-1.5 bg-slate-800 rounded-lg cursor-pointer"
          />
        </div>

        {/* Random Seed */}
        <div className="flex items-center justify-between pt-1 border-t border-slate-800 text-xs">
          <span className="text-slate-400">Semente Aleatória:</span>
          <input
            type="number"
            value={params.randomSeed}
            onChange={(e) => setParam('randomSeed', parseInt(e.target.value) || 1)}
            className="w-20 bg-slate-800 border border-slate-700 rounded px-2 py-0.5 text-right font-mono text-cyan-300"
          />
        </div>

      </div>

    </div>
  );
};
