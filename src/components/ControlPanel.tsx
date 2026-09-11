import React from 'react';
import { useSimulationStore } from '../store/simulationStore';
import { Play, Pause, RotateCcw, Wind, Eye, Layers, RefreshCw, Snowflake, Droplets, Info } from 'lucide-react';

export const ControlPanel: React.FC = () => {
  const {
    params,
    activeScenario,
    isRunning,
    showTrajectories,
    showIsotherms,
    showWindField,
    simulationFamily,
    setParam,
    toggleRunning,
    toggleTrajectories,
    toggleIsotherms,
    toggleWindField,
    resetSimulation,
    resetCurrentScenarioToDefault,
    setSurfaceTemp,
    setWarmNoseTemp,
    setColdLayerDepth,
    setStage
  } = useSimulationStore();

  const isConvective = simulationFamily === 'convective';

  // Current surface temperature from node 0
  const surfaceTemp = params.soundingNodes[0]?.tempC ?? (isConvective ? 22 : 15);
  // Current warm nose temperature from node 2
  const warmNoseTemp = params.soundingNodes[2]?.tempC ?? 5.0;
  // Current cold layer depth from node 1
  const coldDepth = params.soundingNodes[1]?.zKm ?? (activeScenario === 'sleet' ? 1.8 : 0.8);

  const scenarioTitles: Record<string, { title: string; subtitle: string; icon: string; color: string }> = {
    neve: { title: 'Laboratório de Neve', subtitle: 'Coluna 100% Sub-zero (T < 0 °C)', icon: '❄️', color: 'text-sky-300' },
    chuva: { title: 'Laboratório de Chuva Líquida', subtitle: 'Fusão Completa em Camada Quente', icon: '🌧️', color: 'text-cyan-300' },
    sleet: { title: 'Laboratório de Pelotas de Gelo (Sleet)', subtitle: 'Nariz Quente + Recongelação Profunda', icon: '🍚', color: 'text-indigo-300' },
    chuva_congelante: { title: 'Laboratório de Chuva Congelante', subtitle: 'Super-resfriamento em Camada Rasa', icon: '⛸️', color: 'text-teal-300' },
    tempestade_comum: { title: 'Tempestade Comum (Célula Ordinária)', subtitle: 'Ciclo Byers & Braham (1949) Pré-configurado', icon: '🟢', color: 'text-emerald-300' },
    tempestade_forte: { title: 'Tempestade Forte (Multicelular)', subtitle: 'Linha de Flancos & Frente de Rajada', icon: '🟡', color: 'text-amber-300' },
    supercelula: { title: 'Supercélula Severa', subtitle: 'Mesociclone Rotativo & Granizo Gigante', icon: '🔴', color: 'text-rose-300' }
  };

  const currentMeta = scenarioTitles[activeScenario] || {
    title: 'Painel de Controles',
    subtitle: 'Parâmetros Físicos',
    icon: '⚙️',
    color: 'text-white'
  };

  return (
    <div className="bg-slate-900/95 backdrop-blur-md border border-slate-800 rounded-2xl p-4 shadow-xl space-y-4 text-xs">
      
      {/* Header & Quick Action Buttons */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div>
          <h3 className={`font-bold uppercase tracking-wider flex items-center gap-1.5 text-xs ${currentMeta.color}`}>
            <span>{currentMeta.icon}</span> {currentMeta.title}
          </h3>
          <span className="text-[10px] text-slate-400 font-medium">
            {currentMeta.subtitle}
          </span>
        </div>
        
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

      {/* ========================================================================= */}
      {/* 1. SEÇÃO ESPECÍFICA: NEVE (SNOW)                                          */}
      {/* ========================================================================= */}
      {activeScenario === 'neve' && (
        <div className="space-y-3 p-3 rounded-xl bg-sky-950/30 border border-sky-800/40">
          <div className="flex items-center justify-between text-[11px] border-b border-sky-900/50 pb-2">
            <span className="font-bold text-sky-300 flex items-center gap-1">
              <Snowflake className="w-3.5 h-3.5 text-sky-400" /> Parâmetros de Neve
            </span>
            <button
              onClick={resetCurrentScenarioToDefault}
              className="text-[10px] px-2 py-0.5 rounded bg-sky-900/60 hover:bg-sky-800 text-sky-200 flex items-center gap-1 border border-sky-700/50"
              title="Restaurar perfil de Neve padrão NOAA"
            >
              <RefreshCw className="w-2.5 h-2.5" /> Restaurar Padrão
            </button>
          </div>

          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-slate-300">Temperatura da Superfície (T₀):</span>
              <strong className="text-sky-300 font-mono">{surfaceTemp.toFixed(1)} °C</strong>
            </div>
            <input
              type="range"
              min="-18"
              max="-0.5"
              step="0.5"
              value={surfaceTemp}
              onChange={(e) => setSurfaceTemp(parseFloat(e.target.value))}
              className="w-full h-1.5 bg-slate-800 rounded-lg cursor-pointer accent-sky-400"
            />
            <span className="text-[10px] text-slate-400">Deve ser estritamente &lt; 0 °C para preservar o cristal de neve até o solo.</span>
          </div>

          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-slate-300">Tamanho Médio dos Flocos:</span>
              <strong className="text-sky-300 font-mono">{(params.snowflakeSizeMm ?? 3.5).toFixed(1)} mm</strong>
            </div>
            <input
              type="range"
              min="1.5"
              max="6.0"
              step="0.2"
              value={params.snowflakeSizeMm ?? 3.5}
              onChange={(e) => setParam('snowflakeSizeMm', parseFloat(e.target.value))}
              className="w-full h-1.5 bg-slate-800 rounded-lg cursor-pointer accent-sky-400"
            />
          </div>

          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-slate-300">Umidade Sub-nuvem (Sublimação):</span>
              <strong className="text-sky-300 font-mono">{((params.subCloudHumidity ?? 0.85) * 100).toFixed(0)} %</strong>
            </div>
            <input
              type="range"
              min="0.4"
              max="1.0"
              step="0.05"
              value={params.subCloudHumidity ?? 0.85}
              onChange={(e) => setParam('subCloudHumidity', parseFloat(e.target.value))}
              className="w-full h-1.5 bg-slate-800 rounded-lg cursor-pointer accent-sky-400"
            />
            <span className="text-[10px] text-slate-400">Ar muito seco abaixo da nuvem sublima flocos antes de tocarem o solo (virga de neve).</span>
          </div>

          <div className="p-2 rounded-lg bg-sky-950/60 border border-sky-800/40 text-[10px] text-sky-200 flex items-start gap-1.5">
            <Info className="w-3.5 h-3.5 text-sky-400 shrink-0 mt-0.5" />
            <span><strong>Regra NOAA:</strong> Coluna inteiramente sub-congelamento (T &lt; 0 °C em todos os níveis). Os cristais de gelo agregam-se e caem intactos como flocos brancos.</span>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. SEÇÃO ESPECÍFICA: CHUVA LÍQUIDA (RAIN)                                  */}
      {/* ========================================================================= */}
      {activeScenario === 'chuva' && (
        <div className="space-y-3 p-3 rounded-xl bg-cyan-950/30 border border-cyan-800/40">
          <div className="flex items-center justify-between text-[11px] border-b border-cyan-900/50 pb-2">
            <span className="font-bold text-cyan-300 flex items-center gap-1">
              <Droplets className="w-3.5 h-3.5 text-cyan-400" /> Parâmetros de Chuva Líquida
            </span>
            <button
              onClick={resetCurrentScenarioToDefault}
              className="text-[10px] px-2 py-0.5 rounded bg-cyan-900/60 hover:bg-cyan-800 text-cyan-200 flex items-center gap-1 border border-cyan-700/50"
              title="Restaurar perfil de Chuva padrão NOAA"
            >
              <RefreshCw className="w-2.5 h-2.5" /> Restaurar Padrão
            </button>
          </div>

          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-slate-300">Temperatura na Superfície (T₀):</span>
              <strong className="text-cyan-300 font-mono">{surfaceTemp.toFixed(1)} °C</strong>
            </div>
            <input
              type="range"
              min="5"
              max="28"
              step="1"
              value={surfaceTemp}
              onChange={(e) => setSurfaceTemp(parseFloat(e.target.value))}
              className="w-full h-1.5 bg-slate-800 rounded-lg cursor-pointer accent-cyan-400"
            />
            <span className="text-[10px] text-slate-400">Garante camada quente profunda na baixa troposfera.</span>
          </div>

          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-slate-300">Altitude da Isoterma de 0 °C (Nível de Fusão):</span>
              <strong className="text-cyan-300 font-mono">{params.zFreezingKm.toFixed(1)} km</strong>
            </div>
            <input
              type="range"
              min="1.5"
              max="4.5"
              step="0.1"
              value={params.zFreezingKm}
              onChange={(e) => setParam('zFreezingKm', parseFloat(e.target.value))}
              className="w-full h-1.5 bg-slate-800 rounded-lg cursor-pointer accent-cyan-400"
            />
            <span className="text-[10px] text-slate-400">Abaixo desta altitude toda a neve derrete em gotas líquidas de chuva.</span>
          </div>

          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-slate-300">Diâmetro Médio das Gotas de Chuva:</span>
              <strong className="text-cyan-300 font-mono">{(params.raindropSizeMm ?? 2.8).toFixed(1)} mm</strong>
            </div>
            <input
              type="range"
              min="1.0"
              max="5.0"
              step="0.2"
              value={params.raindropSizeMm ?? 2.8}
              onChange={(e) => setParam('raindropSizeMm', parseFloat(e.target.value))}
              className="w-full h-1.5 bg-slate-800 rounded-lg cursor-pointer accent-cyan-400"
            />
          </div>

          <div className="p-2 rounded-lg bg-cyan-950/60 border border-cyan-800/40 text-[10px] text-cyan-200 flex items-start gap-1.5">
            <Info className="w-3.5 h-3.5 text-cyan-400 shrink-0 mt-0.5" />
            <span><strong>Regra NOAA:</strong> Neve formada no topo da nuvem atravessa uma camada quente profunda (T &gt; 0 °C), derretendo 100% antes de tocar a superfície como chuva líquida.</span>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. SEÇÃO ESPECÍFICA: PELOTAS DE GELO / SLEET                               */}
      {/* ========================================================================= */}
      {activeScenario === 'sleet' && (
        <div className="space-y-3 p-3 rounded-xl bg-indigo-950/30 border border-indigo-800/40">
          <div className="flex items-center justify-between text-[11px] border-b border-indigo-900/50 pb-2">
            <span className="font-bold text-indigo-300 flex items-center gap-1">
              <span>🍚</span> Parâmetros de Pelotas de Gelo (Sleet)
            </span>
            <button
              onClick={resetCurrentScenarioToDefault}
              className="text-[10px] px-2 py-0.5 rounded bg-indigo-900/60 hover:bg-indigo-800 text-indigo-200 flex items-center gap-1 border border-indigo-700/50"
              title="Restaurar perfil de Sleet padrão NOAA"
            >
              <RefreshCw className="w-2.5 h-2.5" /> Restaurar Padrão
            </button>
          </div>

          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-slate-300">Temperatura do Nariz Quente (+°C):</span>
              <strong className="text-amber-400 font-mono">+{warmNoseTemp.toFixed(1)} °C</strong>
            </div>
            <input
              type="range"
              min="1.0"
              max="8.0"
              step="0.5"
              value={warmNoseTemp}
              onChange={(e) => setWarmNoseTemp(parseFloat(e.target.value))}
              className="w-full h-1.5 bg-slate-800 rounded-lg cursor-pointer accent-amber-400"
            />
            <span className="text-[10px] text-slate-400">Camada quente elevada que derrete a neve em gotas líquidas.</span>
          </div>

          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-slate-300">Espessura da Camada Fria Superficial:</span>
              <strong className="text-indigo-300 font-mono">{coldDepth.toFixed(1)} km</strong>
            </div>
            <input
              type="range"
              min="1.2"
              max="2.8"
              step="0.1"
              value={coldDepth}
              onChange={(e) => setColdLayerDepth(parseFloat(e.target.value))}
              className="w-full h-1.5 bg-slate-800 rounded-lg cursor-pointer accent-indigo-400"
            />
            <span className="text-[10px] text-indigo-300 font-semibold">Critério NOAA: deve ser &ge; 1.2 km para dar tempo de recongelar no ar!</span>
          </div>

          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-slate-300">Temperatura no Solo (Sub-zero):</span>
              <strong className="text-indigo-300 font-mono">{surfaceTemp.toFixed(1)} °C</strong>
            </div>
            <input
              type="range"
              min="-10"
              max="-0.5"
              step="0.5"
              value={surfaceTemp}
              onChange={(e) => setSurfaceTemp(parseFloat(e.target.value))}
              className="w-full h-1.5 bg-slate-800 rounded-lg cursor-pointer accent-indigo-400"
            />
          </div>

          <div className="p-2 rounded-lg bg-indigo-950/60 border border-indigo-800/40 text-[10px] text-indigo-200 flex items-start gap-1.5">
            <Info className="w-3.5 h-3.5 text-indigo-400 shrink-0 mt-0.5" />
            <span><strong>Regra NOAA:</strong> A neve derrete ao passar pelo nariz quente e, em seguida, atravessa uma camada fria profunda (&ge; 1.2 km). A gota recongela totalmente antes do solo, atingindo o chão como pelotas rígidas e quicantes de gelo translúcido.</span>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. SEÇÃO ESPECÍFICA: CHUVA CONGELANTE (FREEZING RAIN)                      */}
      {/* ========================================================================= */}
      {activeScenario === 'chuva_congelante' && (
        <div className="space-y-3 p-3 rounded-xl bg-teal-950/30 border border-teal-800/40">
          <div className="flex items-center justify-between text-[11px] border-b border-teal-900/50 pb-2">
            <span className="font-bold text-teal-300 flex items-center gap-1">
              <span>⛸️</span> Parâmetros de Chuva Congelante
            </span>
            <button
              onClick={resetCurrentScenarioToDefault}
              className="text-[10px] px-2 py-0.5 rounded bg-teal-900/60 hover:bg-teal-800 text-teal-200 flex items-center gap-1 border border-teal-700/50"
              title="Restaurar perfil de Chuva Congelante padrão NOAA"
            >
              <RefreshCw className="w-2.5 h-2.5" /> Restaurar Padrão
            </button>
          </div>

          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-slate-300">Espessura da Camada Fria Rasa:</span>
              <strong className="text-teal-300 font-mono">{coldDepth.toFixed(2)} km</strong>
            </div>
            <input
              type="range"
              min="0.2"
              max="0.95"
              step="0.05"
              value={coldDepth}
              onChange={(e) => setColdLayerDepth(parseFloat(e.target.value))}
              className="w-full h-1.5 bg-slate-800 rounded-lg cursor-pointer accent-teal-400"
            />
            <span className="text-[10px] text-teal-300 font-semibold">Critério NOAA: deve ser &lt; 1.0 km para NÃO recongelar no ar!</span>
          </div>

          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-slate-300">Temperatura no Solo (Sub-zero):</span>
              <strong className="text-teal-300 font-mono">{surfaceTemp.toFixed(1)} °C</strong>
            </div>
            <input
              type="range"
              min="-8.0"
              max="-0.5"
              step="0.5"
              value={surfaceTemp}
              onChange={(e) => setSurfaceTemp(parseFloat(e.target.value))}
              className="w-full h-1.5 bg-slate-800 rounded-lg cursor-pointer accent-teal-400"
            />
          </div>

          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-slate-300">Taxa de Acréscimo de Gelo Vítreo (Glaze):</span>
              <strong className="text-teal-300 font-mono">{(params.glazeAccretionRateMmH ?? 1.8).toFixed(1)} mm/h</strong>
            </div>
            <input
              type="range"
              min="0.5"
              max="4.5"
              step="0.2"
              value={params.glazeAccretionRateMmH ?? 1.8}
              onChange={(e) => setParam('glazeAccretionRateMmH', parseFloat(e.target.value))}
              className="w-full h-1.5 bg-slate-800 rounded-lg cursor-pointer accent-teal-400"
            />
            <span className="text-[10px] text-slate-400">Espessura do filme de gelo acumulado sobre árvores, asfalto e postes.</span>
          </div>

          <div className="p-2 rounded-lg bg-teal-950/60 border border-teal-800/40 text-[10px] text-teal-200 flex items-start gap-1.5">
            <Info className="w-3.5 h-3.5 text-teal-400 shrink-0 mt-0.5" />
            <span><strong>Regra NOAA:</strong> A neve derrete na camada quente e desce através de uma camada fria superficial rasa (&lt; 1.0 km). Não há tempo suficiente para congelar no ar; as gotas tornam-se super-resfriadas e congelam instantaneamente ao colidir com o solo e objetos frios, cobrindo tudo de gelo vítreo (glaze).</span>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 5. SEÇÃO ESPECÍFICA: TEMPESTADES CONVECTIVAS (PRÉ-CONFIGURADAS)          */}
      {/* ========================================================================= */}
      {isConvective && (
        <div className="space-y-3 p-3 rounded-xl bg-amber-950/30 border border-amber-800/40">
          <div className="flex items-center justify-between text-[11px] border-b border-amber-900/50 pb-2">
            <span className="font-bold text-amber-300 flex items-center gap-1">
              <span>⚡</span> Parâmetros Físicos Pré-Configurados
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-800/60 font-mono font-bold">
              Calibração Automática
            </span>
          </div>

          {/* Read-only Physical Spec Badges */}
          <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
            <div className="bg-slate-950/80 p-2 rounded-lg border border-slate-800">
              <span className="text-slate-400 text-[10px] block">Updraft (w_max):</span>
              <strong className="text-amber-400 text-xs font-bold">{params.wMax.toFixed(0)} m/s</strong>
            </div>

            <div className="bg-slate-950/80 p-2 rounded-lg border border-slate-800">
              <span className="text-slate-400 text-[10px] block">Água Super-resfriada (LWC):</span>
              <strong className="text-cyan-400 text-xs font-bold">{params.lwcMax.toFixed(1)} g/m³</strong>
            </div>

            <div className="bg-slate-950/80 p-2 rounded-lg border border-slate-800">
              <span className="text-slate-400 text-[10px] block">Isoterma de 0 °C:</span>
              <strong className="text-sky-300 text-xs font-bold">{params.zFreezingKm.toFixed(1)} km</strong>
            </div>

            <div className="bg-slate-950/80 p-2 rounded-lg border border-slate-800">
              <span className="text-slate-400 text-[10px] block">Cisalhamento / Ângulo:</span>
              <strong className="text-amber-300 text-xs font-bold">{params.updraftTiltDeg.toFixed(0)}°</strong>
            </div>
          </div>

          {/* Dedicated Didactic Card per Storm Type */}
          {activeScenario === 'tempestade_comum' && (
            <div className="p-2.5 rounded-lg bg-emerald-950/50 border border-emerald-800/40 text-[10px] text-emerald-200 space-y-1 leading-relaxed">
              <div className="font-bold flex items-center gap-1 text-emerald-300">
                <span>🟢</span> Modelo Byers & Braham (1949):
              </div>
              <p>Célula ordinária com updraft puro inicial e ciclo de 30 minutos. As partículas formam-se a partir de zero no updraft ascendente, atingem crescimento máximo no auge maduro (20 min) e desabam no downdraft esvaziando a nuvem na dissipação.</p>
            </div>
          )}

          {activeScenario === 'tempestade_forte' && (
            <div className="space-y-2 pt-1 border-t border-amber-900/40">
              <span className="text-amber-300 text-[11px] font-bold block">Foco na Célula Multicelular:</span>
              <div className="grid grid-cols-4 gap-1 text-[10px]">
                {[
                  { stage: 1, label: 'IV: Flanco' },
                  { stage: 2, label: 'III: Jovem' },
                  { stage: 3, label: 'II: Maduro' },
                  { stage: 4, label: 'I: Queda' }
                ].map((s) => (
                  <button
                    key={s.stage}
                    onClick={() => setStage(s.stage)}
                    className={`py-1 rounded border font-semibold ${
                      params.currentStage === s.stage
                        ? 'bg-amber-500/30 border-amber-400 text-amber-200'
                        : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
              <div className="p-2 rounded-lg bg-amber-950/50 border border-amber-800/40 text-[10px] text-amber-200 leading-relaxed">
                <strong>Modelo Chisholm & Renick (1972):</strong> Linha de flanco contínua. O downdraft da célula madura alimenta a frente de rajada, erguendo novas células sucessivas e mantendo a tempestade ativa por horas.
              </div>
            </div>
          )}

          {activeScenario === 'supercelula' && (
            <div className="p-2.5 rounded-lg bg-rose-950/50 border border-rose-800/40 text-[10px] text-rose-200 space-y-1 leading-relaxed">
              <div className="font-bold flex items-center gap-1 text-rose-300">
                <span>🔴</span> Modelo Browning (1964):
              </div>
              <p>Updraft rotativo violento e inclinado. A separação física entre o canal ascendente e a precipitação permite múltiplos ciclos de recirculação das pedras de granizo, formando camadas concêntricas alternadas até tamanhos gigantes (&gt; 5 cm).</p>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 6. PARÂMETROS GERAIS DO MOTOR (COMUNS A TODOS OS TIPOS)                   */}
      {/* ========================================================================= */}
      <div className="space-y-3 pt-2 border-t border-slate-800">
        
        {/* Number of Particles */}
        <div className="space-y-1">
          <div className="flex justify-between text-xs">
            <span className="text-slate-300">População de Partículas:</span>
            <strong className="text-cyan-400 font-mono">{params.numParticles}</strong>
          </div>
          <input
            type="range"
            min="15"
            max="80"
            step="5"
            value={params.numParticles}
            onChange={(e) => setParam('numParticles', parseInt(e.target.value))}
            className="w-full h-1.5 bg-slate-800 rounded-lg cursor-pointer"
          />
        </div>

        {/* Speed Multiplier */}
        <div className="space-y-1">
          <div className="flex justify-between text-xs">
            <span className="text-slate-300">Velocidade da Simulação:</span>
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
