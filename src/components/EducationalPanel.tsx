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

  const activeScenario = useSimulationStore((state) => state.activeScenario);
  const activeInfo = STAGE_DETAILS.find((s) => s.num === currentStage) || STAGE_DETAILS[3];

  if (activeScenario === 'tempestade_forte') {
    return (
      <div className="bg-slate-900/95 backdrop-blur-md border border-amber-900/60 rounded-2xl p-4 shadow-xl space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-2.5">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-400 bg-amber-950 border border-amber-800/80 px-2.5 py-1 rounded-lg">
              Tempestade Muito Forte (Multicelular)
            </span>
            <span className="text-xs font-mono text-slate-300">
              Elo Intermediário: Convecção Multicelular com Linha de Flanco
            </span>
          </div>
          <span className="text-[11px] font-mono text-amber-300/80">
            Regeneração Contínua por Frente de Rajada
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-2 text-xs">
          <div className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1">
            <span className="text-amber-400 font-bold text-[11px] flex items-center gap-1">
              🌱 Célula IV (Flanco)
            </span>
            <p className="text-slate-400 text-[10px] leading-relaxed">
              Cumulus incipiente (topo 6 km). Ar quente da camada limite ascende suavemente, iniciando os primeiros embriões de graupel.
            </p>
          </div>

          <div className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1">
            <span className="text-amber-400 font-bold text-[11px] flex items-center gap-1">
              📈 Célula III (Congestus)
            </span>
            <p className="text-slate-400 text-[10px] leading-relaxed">
              Torre em rápida ascensão (topo 10 km). Corrente vertical acelerada acumula gotículas super-resfriadas e faz o graupel crescer.
            </p>
          </div>

          <div className="p-2.5 rounded-xl bg-slate-950/80 border border-amber-800/60 space-y-1">
            <span className="text-pink-400 font-bold text-[11px] flex items-center gap-1">
              ⚡ Célula II (Ápice 15 km)
            </span>
            <p className="text-slate-400 text-[10px] leading-relaxed">
              Topo penetrante a 15 km com núcleo de 50 dBZ. Updraft potente (30 m/s) impulsionado pelo choque com a frente de rajada.
            </p>
          </div>

          <div className="p-2.5 rounded-xl bg-slate-950/80 border border-red-900/60 space-y-1">
            <span className="text-red-400 font-bold text-[11px] flex items-center gap-1">
              🌧️ Célula I (Precipitação)
            </span>
            <p className="text-slate-400 text-[10px] leading-relaxed">
              Bigorna downstream, cortina torrencial (30/50 dBZ) e downdraft (-15 m/s) cuja piscina fria alimenta a frente de rajada no solo.
            </p>
          </div>
        </div>

        <div className="text-[11px] text-slate-300 leading-relaxed bg-slate-950/90 border border-amber-500/30 rounded-xl p-2.5">
          💡 <strong>Conceito Fundamental:</strong> Ao contrário da tempestade comum monocelular (que se extingue aos 30 min porque o downdraft sufoca seu updraft), a tempestade muito forte desacopla espacialmente a subida e a descida. A piscina fria gerada pelo downdraft da Célula I atua como uma cunha densa (frente de rajada), forçando o ar quente a subir e criar sucessivamente novas células (IV → III → II → I).
        </div>
      </div>
    );
  }
};
