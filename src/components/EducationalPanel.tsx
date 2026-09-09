import React from 'react';
import { useSimulationStore } from '../store/simulationStore';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const STAGE_DETAILS = [
  {
    num: 1,
    title: 'Etapa 1: Antes da Corrente Ascendente Intensa',
    short: 'Pré-Convecção',
    desc: 'Corrente ascendente incipiente (2 a 5 m/s). Nuvens contendo vapor de água, gotículas líquidas e cristais de gelo nas regiões mais frias. Partículas pequenas permanecem em suspensão ou caem lentamente.'
  },
  {
    num: 2,
    title: 'Etapa 2: Intensificação da Corrente Ascendente',
    short: 'Intensificação',
    desc: 'O jato ascendente atinge 15 a 35 m/s. Gotículas de água líquida são transportadas velozmente para temperaturas negativas (acima do nível de 0°C), produzindo alta concentração de água líquida super-resfriada (SLW).'
  },
  {
    num: 3,
    title: 'Etapa 3: Formação do Graupel (Acreção / Riming)',
    short: 'Graupel',
    desc: 'Cristais de gelo e pequenos flocos colidem com gotas super-resfriadas. As gotas congelam instantaneamente por contato sobre os cristais, formando esferas porosas de graupel (embriões de 2 a 5 mm).'
  },
  {
    num: 4,
    title: 'Etapa 4: Crescimento do Granizo em Camadas e Queda',
    short: 'Crescimento e Queda',
    desc: 'Recirculação no jato concentrado alterna crescimento seco (rime branco leitoso) e crescimento úmido (glaze transparente). Pedras menores derretem na camada quente (virando chuva); grandes atingem o solo.'
  }
];

export const EducationalPanel: React.FC = () => {
  const currentStage = useSimulationStore((state) => state.params.currentStage);
  const setStage = useSimulationStore((state) => state.setStage);

  const activeInfo = STAGE_DETAILS.find((s) => s.num === currentStage) || STAGE_DETAILS[3];

  return (
    <div className="bg-slate-900/95 backdrop-blur-md border border-slate-800 rounded-2xl p-4 shadow-xl space-y-3">
      
      {/* Stage Stepper Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-cyan-400 bg-cyan-950 border border-cyan-800/80 px-2.5 py-1 rounded-lg">
            Evolução da Tempestade
          </span>
          <span className="text-xs font-mono text-slate-300 font-bold">
            Etapa {currentStage} de 4
          </span>
        </div>

        {/* Buttons 1-4 */}
        <div className="flex items-center gap-1.5 flex-1 max-w-xl">
          {STAGE_DETAILS.map((s) => (
            <button
              key={s.num}
              onClick={() => setStage(s.num)}
              className={`flex-1 py-1 px-2 rounded-lg text-xs font-semibold border transition text-center ${
                s.num === currentStage
                  ? 'bg-cyan-600 border-cyan-400 text-white shadow'
                  : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'
              }`}
            >
              {s.num}. {s.short}
            </button>
          ))}
        </div>

        {/* Stepper controls */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setStage(currentStage > 1 ? currentStage - 1 : 4)}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700"
            title="Etapa Anterior"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={() => setStage(currentStage < 4 ? currentStage + 1 : 1)}
            className="px-2.5 py-1 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold shadow flex items-center gap-1"
          >
            Avançar <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Active Stage Description Banner */}
      <div className="text-xs text-slate-300 leading-relaxed bg-slate-950/80 border border-cyan-500/30 rounded-xl p-3">
        <h4 className="font-bold text-cyan-300 text-xs uppercase tracking-wide mb-1">
          {activeInfo.title}
        </h4>
        <p className="text-slate-400 text-[11px]">
          {activeInfo.desc}
        </p>
      </div>

    </div>
  );
};
