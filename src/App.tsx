import React, { useState } from 'react';
import { SimulationCanvas } from './components/SimulationCanvas';
import { ControlPanel } from './components/ControlPanel';
import { TemperatureScale } from './components/TemperatureScale';
import { ParticleInspector } from './components/ParticleInspector';
import { HailCrossSection } from './components/HailCrossSection';
import { ScientificCharts } from './components/ScientificCharts';
import { ScenarioSelector } from './components/ScenarioSelector';
import { EducationalPanel } from './components/EducationalPanel';
import { Legend } from './components/Legend';
import { CloudRain, BarChart3, Microscope, BookOpen } from 'lucide-react';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'sim' | 'charts' | 'anatomy' | 'report'>('sim');

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-cyan-500 selection:text-white">
      
      {/* Top Header */}
      <header className="border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-[1700px] mx-auto px-4 py-2.5 flex flex-wrap items-center justify-between gap-3">
          
          {/* Brand & Subtitle */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-600 to-blue-500 flex items-center justify-center text-xl shadow-lg shadow-cyan-500/20 border border-cyan-400/30">
              ❄️
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-extrabold text-white tracking-tight">
                  Simulador de Granizo em Nuvem Convectiva Profunda
                </h1>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-cyan-950 text-cyan-400 border border-cyan-800/60 hidden sm:inline">
                  PixiJS v8 • Corte 2D
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Acreção Contínua • Schumann-Ludlam (Seco/Úmido) • Recirculação e Derretimento Seletivo
              </p>
            </div>
          </div>

          {/* Scenario Selector */}
          <ScenarioSelector />

          {/* Navigation Tabs */}
          <nav className="flex items-center gap-1 bg-slate-900 border border-slate-800 p-1 rounded-xl text-xs font-medium">
            <button
              onClick={() => setActiveTab('sim')}
              className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition font-semibold ${
                activeTab === 'sim' ? 'bg-cyan-600 text-white shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              <CloudRain className="w-3.5 h-3.5" /> Simulação
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

      {/* Main Container */}
      <main className="flex-1 max-w-[1700px] w-full mx-auto p-4 space-y-4">
        
        {/* Stage Timeline Stepper */}
        <EducationalPanel />

        {/* TAB 1: Main Simulation */}
        {activeTab === 'sim' && (
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 items-start">
            
            {/* Left 9 Cols: PixiJS Canvas Viewport & Legend */}
            <div className="xl:col-span-9 space-y-3">
              <div className="relative">
                <SimulationCanvas />
                
                {/* Floating Top Right Inspector */}
                <div className="absolute top-3 right-3 max-w-xs w-full pointer-events-auto">
                  <ParticleInspector />
                </div>

                {/* Floating Bottom Left Legend */}
                <div className="absolute bottom-3 left-3 pointer-events-auto">
                  <Legend />
                </div>
              </div>

              {/* Surface Fallout Histogram */}
              <ScientificCharts />
            </div>

            {/* Right 3 Cols: Sliders & Temperature Scale */}
            <div className="xl:col-span-3 space-y-3">
              <ControlPanel />
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
                Evolução contínua da altitude, temperatura ambiente, diâmetro, massa e balanço entre velocidade terminal e corrente ascendente.
              </p>
            </div>
            <ScientificCharts />
          </div>
        )}

        {/* TAB 3: Anatomy & Concentric Rings */}
        {activeTab === 'anatomy' && (
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="max-w-3xl mx-auto space-y-4">
              <h2 className="text-xl font-extrabold text-white flex items-center gap-2">
                <Microscope className="w-6 h-6 text-cyan-400" /> Estrutura Radial em Camadas de Cebola (*Onion-Skin*)
              </h2>
              <p className="text-xs text-slate-300 leading-relaxed">
                Cada ciclo de ascensão e descida pelo núcleo da corrente ascendente deposita anéis concêntricos alternados de gelo, registrando a história microfísica da tempestade.
              </p>
              <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl">
                <ParticleInspector />
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: Full Scientific Report & Mitigation */}
        {activeTab === 'report' && (
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-2xl space-y-6">
            <div className="border-b border-slate-800 pb-4">
              <span className="text-xs uppercase font-bold text-cyan-400 tracking-wider">Revisão Física 2026</span>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-white mt-1">
                Física da Formação de Granizo e Eficácia dos Sistemas de Supressão
              </h2>
              <p className="text-sm text-slate-300 mt-1">
                Análise técnica da dinâmica convectiva em Santa Catarina, quebra de paradigma na Ilha de Florianópolis e desmistificação dos canhões sônicos.
              </p>
            </div>

            {/* Video Card */}
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
              <div>
                <h4 className="font-bold text-white text-sm">Vídeo: "Uma MENTIRA com mais de 100 anos de idade?" (Guia da Floresta)</h4>
                <p className="text-xs text-slate-400">Histórico de Albert Stiger (1896), medições de sobrepressão acústica e viés de confirmação.</p>
              </div>
              <a
                href="https://www.youtube.com/watch?v=IRtXNqBBxX8&t=135s"
                target="_blank"
                rel="noreferrer"
                className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-bold transition shadow"
              >
                Assistir no YouTube ➔
              </a>
            </div>

            {/* Scientific Systems Comparison Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border border-slate-800 rounded-xl overflow-hidden">
                <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                  <tr>
                    <th className="p-3">Sistema</th>
                    <th className="p-3">Princípio Físico</th>
                    <th className="p-3">Alcance Vertical</th>
                    <th className="p-3">Eficácia Comprovada</th>
                    <th className="p-3">Consenso Científico (OMM)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 text-slate-300">
                  <tr className="bg-red-950/20">
                    <td className="p-3 font-bold text-red-400">Canhão Sônico / Acústico</td>
                    <td className="p-3">Ondas de choque de acetileno</td>
                    <td className="p-3 font-mono text-red-300">&lt; 800 - 1.000 m (1,3 hPa)</td>
                    <td className="p-3 font-bold text-red-400">0% (Inoperante)</td>
                    <td className="p-3 text-red-400">Sem fundamento físico / Rejeitado</td>
                  </tr>
                  <tr>
                    <td className="p-3 font-bold text-cyan-300">Queimadores de Solo (AgI)</td>
                    <td className="p-3">Semeadura glaciogênica dispersa pelo vento</td>
                    <td className="p-3 font-mono text-slate-300">1.500 - 3.000 m</td>
                    <td className="p-3 text-cyan-300">20% a 35%</td>
                    <td className="p-3 text-slate-300">Dependente da turbulência na camada limite</td>
                  </tr>
                  <tr>
                    <td className="p-3 font-bold text-cyan-300">Foguetes Antigranizo (AgI)</td>
                    <td className="p-3">Injeção balística direta na zona de -10°C</td>
                    <td className="p-3 font-mono text-slate-300">4.000 - 8.000 m</td>
                    <td className="p-3 text-cyan-300">45% a 65%</td>
                    <td className="p-3 text-slate-300">Padrão na Sérvia, Bulgária e China</td>
                  </tr>
                  <tr>
                    <td className="p-3 font-bold text-cyan-300">Aeronaves Tripuladas (AgI)</td>
                    <td className="p-3">Flares no influxo ascendente da base da nuvem</td>
                    <td className="p-3 font-mono text-slate-300">2.000 - 4.000 m</td>
                    <td className="p-3 text-cyan-300">30% a 50%</td>
                    <td className="p-3 text-slate-300">Alto risco operacional em turbulência severa</td>
                  </tr>
                  <tr className="bg-cyan-950/20">
                    <td className="p-3 font-bold text-cyan-400">Drones Agrícolas Autônomos</td>
                    <td className="p-3">VANTs elétricos guiados por radar Doppler</td>
                    <td className="p-3 font-mono text-cyan-300">2.000 - 6.000 m</td>
                    <td className="p-3 text-cyan-400">40% a 60% (Fronteira)</td>
                    <td className="p-3 text-emerald-400 font-semibold">Uso duplo: pulverização e mitigação</td>
                  </tr>
                  <tr className="bg-emerald-950/20">
                    <td className="p-3 font-bold text-emerald-400">Telas de PEAD no Solo</td>
                    <td className="p-3">Barreira mecânica com absorção elástica</td>
                    <td className="p-3 font-mono text-emerald-300">Solo (4 a 5 m)</td>
                    <td className="p-3 font-bold text-emerald-400">100% (Garantia Física)</td>
                    <td className="p-3 text-emerald-300 font-semibold">Solução definitiva comprovada</td>
                  </tr>
                </tbody>
              </table>
            </div>

          </div>
        )}

      </main>

      {/* Global Cross Section Modal */}
      <HailCrossSection />

      {/* Footer */}
      <footer className="border-t border-slate-800/80 bg-slate-950 py-4 text-center text-xs text-slate-500">
        <p>Simulador Didático de Granizo em Nuvem Convectiva Profunda • Modelo Conceitual e Educacional</p>
        <p className="text-[11px] text-slate-600 mt-0.5">Desenvolvido com React, TypeScript, PixiJS v8 e Tailwind CSS.</p>
      </footer>

    </div>
  );
};

export default App;
