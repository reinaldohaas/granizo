import React from 'react';

export const Legend: React.FC = () => {
  return (
    <div className="bg-slate-900/95 backdrop-blur-md border border-slate-800 rounded-xl px-3 py-2 text-[11px] shadow-lg flex flex-wrap items-center gap-3">
      <span className="font-bold text-slate-300 uppercase tracking-wider text-[10px]">Legenda:</span>
      
      <div className="flex items-center gap-1.5">
        <span className="w-2.5 h-2.5 rounded-full bg-blue-600 inline-block shadow-sm"></span>
        <span className="text-slate-300">Gota Líquida (T &gt; 0°C)</span>
      </div>

      <div className="flex items-center gap-1.5">
        <span className="w-2.5 h-2.5 rounded-full bg-cyan-300 inline-block shadow-[0_0_8px_rgba(56,189,248,0.8)]"></span>
        <span className="text-cyan-200 font-semibold">Água Super-resfriada (SLW)</span>
      </div>

      <div className="flex items-center gap-1.5">
        <span className="w-2.5 h-2.5 rotate-45 bg-white inline-block"></span>
        <span className="text-white">Cristal de Gelo</span>
      </div>

      <div className="flex items-center gap-1.5">
        <span className="w-3 h-3 rounded-full bg-slate-300 border border-slate-500 inline-block"></span>
        <span className="text-slate-200">Graupel (Poroso)</span>
      </div>

      <div className="flex items-center gap-1.5">
        <span className="w-3.5 h-3.5 rounded-full bg-white border border-cyan-400 inline-block shadow-sm"></span>
        <span className="text-amber-300 font-semibold">Granizo em Camadas</span>
      </div>

      <div className="flex items-center gap-1.5">
        <span className="w-2 h-4 rounded-full bg-cyan-400/80 inline-block"></span>
        <span className="text-cyan-300">Chuva (Derretido)</span>
      </div>
    </div>
  );
};
