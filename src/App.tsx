import React, { useState } from 'react';
import { SimulationCanvas } from './components/SimulationCanvas';
import { ControlPanel } from './components/ControlPanel';
import { TemperatureScale } from './components/TemperatureScale';
import { ParticleInspector } from './components/ParticleInspector';
import { HailCrossSection } from './components/HailCrossSection';
import { ScientificCharts } from './components/ScientificCharts';
import { ScenarioSelector } from './components/ScenarioSelector';
import { Legend } from './components/Legend';
import { useSimulationStore } from './store/simulationStore';
import { CloudRain, BarChart3, Microscope, BookOpen, RotateCcw, Play, Pause } from 'lucide-react';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'sim' | 'charts' | 'anatomy' | 'report'>('sim');
  const isRunning = useSimulationStore((state) => state.isRunning);
  const toggleRunning = useSimulationStore((state) => state.toggleRunning);
  const resetSimulation = useSimulationStore((state) => state.resetSimulation);
  const groundStats = useSimulationStore((state) => state.groundStats);
  const simulationFamily = useSimulationStore((state) => state.simulationFamily);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-cyan-500 selection:text-white">
      
      {/* Top Header Bar */}
      <header className="border-b border-slate-800/80 bg-slate-900/80 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-[1760px] mx-auto px-4 py-2.5 flex flex-wrap items-center justify-between gap-3">
          
          {/* Logo & Identity */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-600 to-blue-500 flex items-center justify-center text-lg shadow-lg shadow-cyan-500/20 border border-cyan-400/30">
              ❄️
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-extrabold text-white tracking-tight">
                  Simulador de Granizo em Nuvem Convectiva Profunda
                </h1>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-cyan-950 text-cyan-400 border border-cyan-800/60 hidden md:inline">
                  Física NOAA • Corte 2D
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Acreção Contínua • Schumann-Ludlam (Seco/Úmido) • Recirculação e Derretimento
              </p>
            </div>
          </div>

          {/* Quick Scenario Selector */}
          <ScenarioSelector />

          {/* Master Play/Pause & Reset Controls */}
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

          {/* Navigation Tabs */}
          <nav className="flex items-center gap-1 bg-slate-900 border border-slate-800 p-1 rounded-xl text-xs font-medium">
            <button
              onClick={() => setActiveTab('sim')}
              className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition font-semibold ${
                activeTab === 'sim' ? 'bg-cyan-600 text-white shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              <CloudRain className="w-3.5 h-3.5" /> Simulação & Controles
            </button>
            <button
              onClick={() => setActiveTab('charts')}
              className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition font-semibold ${
                activeTab === 'charts' ? 'bg-cyan-600 text-white shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" /> Gráficos
            </button>
            <button
              onClick={() => setActiveTab('anatomy')}
              className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition font-semibold ${
                activeTab === 'anatomy' ? 'bg-cyan-600 text-white shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Microscope className="w-3.5 h-3.5" /> Anatomia
            </button>
            <button
              onClick={() => setActiveTab('report')}
              className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition font-semibold ${
                activeTab === 'report' ? 'bg-cyan-600 text-white shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" /> Relatório
            </button>
          </nav>

        </div>
      </header>

      {/* Main App Container */}
      <main className="flex-1 max-w-[1760px] w-full mx-auto p-3 sm:p-4">
        
        {/* TAB 1: Main Simulation - CONTROLS DIRECTLY SIDE-BY-SIDE WITH THE CLOUD */}
        {activeTab === 'sim' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
            
            {/* LEFT COLUMN: THE CLOUD SIMULATION VIEWPORT (7 or 8 COLS) */}
            <div className="lg:col-span-7 xl:col-span-8 space-y-3">
              {/* Cloud Canvas */}
              <div className="relative">
                <SimulationCanvas />
                
                {/* Floating Bottom Left Legend */}
                <div className="absolute bottom-3 left-3 pointer-events-auto">
                  <Legend />
                </div>
              </div>

              {/* Surface Fallout Stats & Inspector Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <ParticleInspector />
                <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-xl text-xs space-y-2">
                  <h4 className="font-bold text-white flex items-center justify-between text-xs border-b border-slate-800 pb-2">
                    <span className="flex items-center gap-1.5">
                      <span>📊</span> Acúmulo de Hidrometeoros no Solo
                    </span>
                    <span className={`text-[10px] font-mono px-2 py-0.5 rounded ${
                      simulationFamily === 'thermodynamic' ? 'bg-blue-950 text-blue-300 border border-blue-800/60' : 'bg-amber-950 text-amber-300 border border-amber-800/60'
                    }`}>
                      {simulationFamily === 'thermodynamic' ? 'Modo NOAA NESDIS' : 'Modo Convectivo'}
                    </span>
                  </h4>
                  
                  {simulationFamily === 'thermodynamic' ? (
                    <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
                      <div className="bg-slate-950 p-2 rounded-lg border border-slate-800 flex justify-between items-center">
                        <span className="text-white">❄️ Neve (Snow):</span>
                        <strong className="text-white text-xs">{groundStats.snowCount}</strong>
                      </div>
                      <div className="bg-slate-950 p-2 rounded-lg border border-slate-800 flex justify-between items-center">
                        <span className="text-cyan-400">🌧️ Chuva (Rain):</span>
                        <strong className="text-white text-xs">{groundStats.rainCount}</strong>
                      </div>
                      <div className="bg-slate-950 p-2 rounded-lg border border-slate-800 flex justify-between items-center">
                        <span className="text-indigo-300">🍚 Pelotas de gelo (sleet):</span>
                        <strong className="text-white text-xs">{groundStats.sleetCount}</strong>
                      </div>
                      <div className="bg-slate-950 p-2 rounded-lg border border-slate-800 flex justify-between items-center">
                        <span className="text-sky-300">⛸️ Chuva Congelante:</span>
                        <strong className="text-white text-xs">{groundStats.freezingRainCount}</strong>
                      </div>
                      <div className="col-span-2 bg-slate-950 p-2 rounded-lg border border-cyan-800/60 flex justify-between items-center">
                        <span className="text-cyan-300 font-sans font-semibold">🧊 Filme de Gelo Vítreo (Glaze):</span>
                        <strong className="text-cyan-300 text-xs font-mono">{groundStats.glazeIceThicknessMm.toFixed(2)} mm</strong>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
                      <div className="bg-slate-950 p-2 rounded-lg border border-slate-800 flex justify-between items-center">
                        <span className="text-cyan-400">🌧️ Chuva:</span>
                        <strong className="text-white text-xs">{groundStats.rainCount}</strong>
                      </div>
                      <div className="bg-slate-950 p-2 rounded-lg border border-slate-800 flex justify-between items-center">
                        <span className="text-slate-300">🍚 Graupel:</span>
                        <strong className="text-white text-xs">{groundStats.graupelCount}</strong>
                      </div>
                      <div className="bg-slate-950 p-2 rounded-lg border border-slate-800 flex justify-between items-center">
                        <span className="text-blue-300">🧊 Peq. (&lt;15mm):</span>
                        <strong className="text-white text-xs">{groundStats.smallHailCount}</strong>
                      </div>
                      <div className="bg-slate-950 p-2 rounded-lg border border-slate-800 flex justify-between items-center">
                        <span className="text-amber-300">⚠️ Méd. (15-30mm):</span>
                        <strong className="text-white text-xs">{groundStats.mediumHailCount}</strong>
                      </div>
                      <div className="bg-slate-950 p-2 rounded-lg border border-slate-800 flex justify-between items-center">
                        <span className="text-orange-400">🚨 Gde. (30-50mm):</span>
                        <strong className="text-white text-xs">{groundStats.largeHailCount}</strong>
                      </div>
                      <div className="bg-slate-950 p-2 rounded-lg border border-slate-800 flex justify-between items-center">
                        <span className="text-rose-400">💥 Gigante (&gt;50mm):</span>
                        <strong className="text-white text-xs">{groundStats.giantHailCount}</strong>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* RIGHT COLUMN: CONTROLS DIRECTLY NEXT TO THE CLOUD (4 or 5 COLS) */}
            <div className="lg:col-span-5 xl:col-span-4 space-y-3">
              {/* Physics & Environmental Control Panel */}
              <ControlPanel />
              
              {/* NOAA Interactive Sounding & Temperature Scale */}
              <TemperatureScale />
            </div>

          </div>
        )}

        {/* TAB 2: Full Scientific Charts */}
        {activeTab === 'charts' && (
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="border-b border-slate-800 pb-3">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-cyan-400" /> Séries Temporais da Pedra Selecionada
              </h2>
              <p className="text-xs text-slate-400">
                Evolução contínua da altitude, temperatura ambiente, diâmetro, massa e balanço aerodinâmico entre velocidade terminal e corrente ascendente.
              </p>
            </div>
            <ScientificCharts />
          </div>
        )}

        {/* TAB 3: Hailstone Anatomy */}
        {activeTab === 'anatomy' && (
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="max-w-3xl mx-auto space-y-4">
              <h2 className="text-xl font-extrabold text-white flex items-center gap-2">
                <Microscope className="w-6 h-6 text-cyan-400" /> Estrutura Radial em Camadas de Cebola (*Onion-Skin*)
              </h2>
              <p className="text-xs text-slate-300 leading-relaxed">
                Cada ciclo de ascensão e descida pelo núcleo da corrente ascendente deposita anéis concêntricos alternados de gelo:
                gelo seco opaco com bolhas de ar aprisionadas (camada branca) e gelo úmido vítreo transparente (camada escura/translúcida).
              </p>
              <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl">
                <ParticleInspector />
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: Scientific & Mitigation Report */}
        {activeTab === 'report' && (
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-6 max-w-5xl mx-auto">
            <div className="border-b border-slate-800 pb-4">
              <h2 className="text-xl font-extrabold text-white">Relatório Científico: Formação de Granizo e Sistemas de Mitigação</h2>
              <p className="text-xs text-slate-400 mt-1">Análise comparativa de canhões sônicos, semeadura com iodeto de prata e telas antigranizo</p>
            </div>

            <div className="prose prose-invert max-w-none text-xs leading-relaxed space-y-4">
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                <h3 className="text-sm font-bold text-cyan-400">1. Por que Mudanças Climáticas Produzem Granizo Maior?</h3>
                <p className="text-slate-300">
                  O aquecimento global intensifica a energia potencial convectiva disponível (CAPE) por meio do aumento da umidade específica (relação Clausius-Clapeyron, ~7% mais vapor por °C de aquecimento). Correntes ascendentes mais vigorosas sustentam pedras de maior diâmetro por mais tempo na zona supercongelada (-10°C a -30°C). Ao mesmo tempo, a elevação da isoterma de 0°C derrete os granizos menores (&lt; 2 cm) durante a queda, fazendo com que chegue à superfície menos granizo pequeno, porém com maior proporção de pedras gigantes e destrutivas.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                <h3 className="text-sm font-bold text-cyan-400">2. Eficácia Real dos Sistemas de Mitigação Antigranizo</h3>
                <table className="w-full text-left text-xs border border-slate-800 rounded-lg overflow-hidden">
                  <thead className="bg-slate-800 text-slate-300">
                    <tr>
                      <th className="p-2.5">Sistema</th>
                      <th className="p-2.5">Mecanismo Físico</th>
                      <th className="p-2.5">Eficácia Científica</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 text-slate-300 font-mono text-[11px]">
                    <tr>
                      <td className="p-2.5 font-bold text-rose-400">Canhões Antigranizo</td>
                      <td className="p-2.5">Ondas de choque acústicas no solo (onda atinge ~300 m; nuvem está a 3.000 m)</td>
                      <td className="p-2.5 text-rose-400 font-bold">0% (Inoperante / Placebo)</td>
                    </tr>
                    <tr>
                      <td className="p-2.5 font-bold text-amber-400">Semeadura (AgI)</td>
                      <td className="p-2.5">Competição benéfica de nucleação artificial de gelo via foguetes/aeronaves</td>
                      <td className="p-2.5 text-amber-400 font-bold">Incerto / Marginal (0% a 20%)</td>
                    </tr>
                    <tr>
                      <td className="p-2.5 font-bold text-emerald-400">Telas Mecânicas</td>
                      <td className="p-2.5">Barreira mecânica de polietileno sobre pomares</td>
                      <td className="p-2.5 text-emerald-400 font-bold">100% Garantido</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                <h3 className="text-sm font-bold text-cyan-400">3. O Ciclo de Vida da Tempestade Comum (Byers & Braham, 1949)</h3>
                <p className="text-slate-300">
                  O diagrama clássico do <em>Thunderstorm Project</em> ilustra a evolução de 30 minutos de uma célula convectiva ordinária (sem cisalhamento vertical do vento).
                </p>
                <div className="bg-white p-3 rounded-lg flex justify-center">
                  <img
                    src="./assets/byers_braham_1949_storm.png"
                    alt="Diagrama de Byers & Braham (1949)"
                    className="max-h-80 object-contain"
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 text-[11px]">
                  <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                    <strong className="text-amber-400 block mb-1">1. Cumulus (0-15 min)</strong>
                    Updraft puro. Nuvem cresce de 4 km até 9 km. Gotículas sobem e formam núcleos concêntricos de condensação (1 e 3 g/m³). Nenhuma chuva toca o solo.
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                    <strong className="text-rose-400 block mb-1">2. Maduro (15-22 min)</strong>
                    Auge da tempestade. Topo atinge a tropopausa (~11 km) e abre a bigorna. Núcleo atinge densidade máxima (5 g/m³). O peso da água desencadeia o downdraft que atinge o solo com chuva torrencial.
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                    <strong className="text-blue-400 block mb-1">3. Dissipação (22-30 min)</strong>
                    O downdraft asfixia o canal de entrada do ar quente e úmido. A convecção cessa, o núcleo drena para o solo e resta apenas a bigorna residual estratificada.
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

      </main>

      {/* Global Cross Section Modal */}
      <HailCrossSection />

      {/* Footer */}
      <footer className="border-t border-slate-800/80 bg-slate-950 py-3 text-center text-xs text-slate-500">
        <p>Simulador Didático de Granizo em Nuvem Convectiva Profunda • Padrão NOAA NESDIS / CIMSS</p>
      </footer>

    </div>
  );
};

export default App;
