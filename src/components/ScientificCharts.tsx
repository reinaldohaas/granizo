import React, { useEffect, useRef } from 'react';
import { useSimulationStore } from '../store/simulationStore';

export const ScientificCharts: React.FC = () => {
  const tel = useSimulationStore((state) => state.selectedTelemetry);
  const stats = useSimulationStore((state) => state.groundStats);

  // Canvas refs for lightweight high-performance rendering
  const canvasAltRef = useRef<HTMLCanvasElement | null>(null);
  const canvasDiamRef = useRef<HTMLCanvasElement | null>(null);
  const canvasTempRef = useRef<HTMLCanvasElement | null>(null);
  const canvasVelRef = useRef<HTMLCanvasElement | null>(null);

  // History buffers
  const historyRef = useRef<{
    alt: number[];
    diam: number[];
    temp: number[];
    w: number[];
    vt: number[];
  }>({
    alt: [],
    diam: [],
    temp: [],
    w: [],
    vt: []
  });

  useEffect(() => {
    if (!tel) return;

    const hist = historyRef.current;
    hist.alt.push(tel.zKm);
    hist.diam.push(tel.diameterMm);
    hist.temp.push(tel.temperatureC);
    hist.w.push(tel.updraftMs);
    hist.vt.push(tel.terminalVelocityMs);

    if (hist.alt.length > 70) {
      hist.alt.shift();
      hist.diam.shift();
      hist.temp.shift();
      hist.w.shift();
      hist.vt.shift();
    }

    const drawLine = (canvas: HTMLCanvasElement | null, data: number[], min: number, max: number, color: string, unit: string) => {
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (data.length < 2) return;

      ctx.strokeStyle = color;
      ctx.lineWidth = 2.0;
      ctx.beginPath();
      for (let i = 0; i < data.length; i++) {
        const x = (i / (data.length - 1)) * canvas.width;
        const y = canvas.height - ((data[i] - min) / (max - min)) * canvas.height;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      const last = data[data.length - 1];
      ctx.fillStyle = color;
      ctx.font = 'bold 10px JetBrains Mono, monospace';
      ctx.fillText(`${last.toFixed(1)} ${unit}`, canvas.width - 65, 16);
    };

    drawLine(canvasAltRef.current, hist.alt, 0, 14, '#38bdf8', 'km');
    drawLine(canvasDiamRef.current, hist.diam, 0, 50, '#f59e0b', 'mm');
    drawLine(canvasTempRef.current, hist.temp, -65, 25, '#10b981', '°C');

    // Velocities comparison
    const cv = canvasVelRef.current;
    if (cv && hist.w.length > 1) {
      const g = cv.getContext('2d');
      if (g) {
        g.clearRect(0, 0, cv.width, cv.height);
        // Updraft (Cyan)
        g.strokeStyle = '#38bdf8';
        g.lineWidth = 1.8;
        g.beginPath();
        for (let i = 0; i < hist.w.length; i++) {
          const x = (i / (hist.w.length - 1)) * cv.width;
          const y = cv.height - (hist.w[i] / 55.0) * cv.height;
          if (i === 0) g.moveTo(x, y);
          else g.lineTo(x, y);
        }
        g.stroke();

        // Terminal fall velocity (Red)
        g.strokeStyle = '#ef4444';
        g.lineWidth = 1.8;
        g.beginPath();
        for (let i = 0; i < hist.vt.length; i++) {
          const x = (i / (hist.vt.length - 1)) * cv.width;
          const y = cv.height - (hist.vt[i] / 55.0) * cv.height;
          if (i === 0) g.moveTo(x, y);
          else g.lineTo(x, y);
        }
        g.stroke();

        g.font = '9px Inter, sans-serif';
        g.fillStyle = '#38bdf8';
        g.fillText(`w = ${hist.w[hist.w.length - 1].toFixed(1)} m/s`, 10, 16);
        g.fillStyle = '#ef4444';
        g.fillText(`vt = ${hist.vt[hist.vt.length - 1].toFixed(1)} m/s`, 100, 16);
      }
    }
  }, [tel]);

  const tot = Math.max(1, stats.totalGrounded);
  const pRain = ((stats.rainCount / tot) * 100).toFixed(0);
  const pGraupel = ((stats.graupelCount / tot) * 100).toFixed(0);
  const pSmall = ((stats.smallHailCount / tot) * 100).toFixed(0);
  const pMed = ((stats.mediumHailCount / tot) * 100).toFixed(0);
  const pLarge = (((stats.largeHailCount + stats.giantHailCount) / tot) * 100).toFixed(0);

  return (
    <div className="space-y-4">
      
      {/* 4 Time Series Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        
        <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 shadow-inner">
          <div className="flex justify-between text-xs mb-1 font-semibold">
            <span className="text-cyan-400">Altitude (km) vs Tempo</span>
            <span className="text-slate-500 font-mono text-[10px]">Trajetória vertical</span>
          </div>
          <canvas ref={canvasAltRef} width={420} height={160} className="w-full h-auto bg-slate-950 rounded" />
        </div>

        <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 shadow-inner">
          <div className="flex justify-between text-xs mb-1 font-semibold">
            <span className="text-amber-400">Diâmetro (mm) vs Tempo</span>
            <span className="text-slate-500 font-mono text-[10px]">Acreção & Derretimento</span>
          </div>
          <canvas ref={canvasDiamRef} width={420} height={160} className="w-full h-auto bg-slate-950 rounded" />
        </div>

        <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 shadow-inner">
          <div className="flex justify-between text-xs mb-1 font-semibold">
            <span className="text-emerald-400">Temperatura (°C) vs Tempo</span>
            <span className="text-slate-500 font-mono text-[10px]">Regimes térmicos</span>
          </div>
          <canvas ref={canvasTempRef} width={420} height={160} className="w-full h-auto bg-slate-950 rounded" />
        </div>

        <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 shadow-inner">
          <div className="flex justify-between text-xs mb-1 font-semibold">
            <span className="text-purple-400">Updraft (w) vs Vel. Terminal (v<sub>t</sub>)</span>
            <span className="text-slate-500 font-mono text-[10px]">Queda se v<sub>t</sub> &gt; w</span>
          </div>
          <canvas ref={canvasVelRef} width={420} height={160} className="w-full h-auto bg-slate-950 rounded" />
        </div>

      </div>

      {/* Surface Fallout Histogram */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-3 text-xs">
          <h3 className="font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
            <span>📊</span> Distribuição dos Hidrometeoros no Solo
          </h3>
          <span className="font-mono text-slate-400">Total: <strong className="text-white">{stats.totalGrounded}</strong> impactos</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-2.5">
            <div className="flex justify-between text-xs">
              <span className="text-blue-400 font-semibold">🌧️ Chuva</span>
              <span className="font-mono text-slate-400 text-[11px]">{pRain}%</span>
            </div>
            <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden my-1.5">
              <div className="bg-blue-500 h-full transition-all duration-300" style={{ width: `${pRain}%` }} />
            </div>
            <span className="font-mono font-bold text-white text-xs">{stats.rainCount} derretidos</span>
          </div>

          <div className="bg-slate-950 border border-slate-800 rounded-xl p-2.5">
            <div className="flex justify-between text-xs">
              <span className="text-slate-300 font-semibold">⚪ Graupel</span>
              <span className="font-mono text-slate-400 text-[11px]">{pGraupel}%</span>
            </div>
            <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden my-1.5">
              <div className="bg-slate-400 h-full transition-all duration-300" style={{ width: `${pGraupel}%` }} />
            </div>
            <span className="font-mono font-bold text-white text-xs">{stats.graupelCount} pedras</span>
          </div>

          <div className="bg-slate-950 border border-slate-800 rounded-xl p-2.5">
            <div className="flex justify-between text-xs">
              <span className="text-cyan-400 font-semibold">❄️ Pequeno (&lt;20mm)</span>
              <span className="font-mono text-slate-400 text-[11px]">{pSmall}%</span>
            </div>
            <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden my-1.5">
              <div className="bg-cyan-500 h-full transition-all duration-300" style={{ width: `${pSmall}%` }} />
            </div>
            <span className="font-mono font-bold text-white text-xs">{stats.smallHailCount} pedras</span>
          </div>

          <div className="bg-slate-950 border border-slate-800 rounded-xl p-2.5">
            <div className="flex justify-between text-xs">
              <span className="text-amber-400 font-semibold">🌨️ Médio (20-50mm)</span>
              <span className="font-mono text-slate-400 text-[11px]">{pMed}%</span>
            </div>
            <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden my-1.5">
              <div className="bg-amber-500 h-full transition-all duration-300" style={{ width: `${pMed}%` }} />
            </div>
            <span className="font-mono font-bold text-white text-xs">{stats.mediumHailCount} pedras</span>
          </div>

          <div className="bg-slate-950 border border-slate-800 rounded-xl p-2.5">
            <div className="flex justify-between text-xs">
              <span className="text-red-400 font-semibold">☄️ Grande (&gt;50mm)</span>
              <span className="font-mono text-slate-400 text-[11px]">{pLarge}%</span>
            </div>
            <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden my-1.5">
              <div className="bg-red-500 h-full transition-all duration-300" style={{ width: `${pLarge}%` }} />
            </div>
            <span className="font-mono font-bold text-white text-xs">{stats.largeHailCount + stats.giantHailCount} pedras</span>
          </div>

        </div>
      </div>

    </div>
  );
};
