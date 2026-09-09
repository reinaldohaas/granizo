import React, { useRef, useState, useEffect, useCallback } from 'react';
import { useSimulationStore } from '../store/simulationStore';
import { AtmosphericProfile } from '../simulation/AtmosphericProfile';
import { Thermometer, Droplets, Info, Layers } from 'lucide-react';

export const AtmosphericSounding: React.FC = () => {
  const soundingNodes = useSimulationStore((state) => state.params.soundingNodes);
  const setSoundingNode = useSimulationStore((state) => state.setSoundingNode);
  const family = useSimulationStore((state) => state.params.family);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [activeDrag, setActiveDrag] = useState<{ index: number; isDewPoint: boolean } | null>(null);

  const atmos = new AtmosphericProfile();
  const diagnosis = atmos.classifyPrecipitation(soundingNodes);

  // Coordinate mapping for sounding canvas:
  // Temperature domain: -70°C to +35°C
  // Altitude domain: 0 to 14 km
  const WIDTH = 340;
  const HEIGHT = 260;

  const tToX = (t: number) => 40 + ((t + 70.0) / 105.0) * (WIDTH - 60);
  const xToT = (x: number) => -70.0 + ((x - 40) / (WIDTH - 60)) * 105.0;

  const zToY = (z: number) => (HEIGHT - 32) - (z / 14.0) * (HEIGHT - 54);
  const yToZ = (y: number) => Math.max(0, Math.min(14, ((HEIGHT - 32 - y) / (HEIGHT - 54)) * 14.0));

  // Draw sounding diagram
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, WIDTH, HEIGHT);

    // 1. Grid Lines
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;

    // Horizontal altitude lines (0, 3, 6, 9, 12 km)
    for (let z = 0; z <= 12; z += 3) {
      const y = zToY(z);
      ctx.beginPath();
      ctx.moveTo(40, y);
      ctx.lineTo(WIDTH - 20, y);
      ctx.stroke();

      ctx.fillStyle = '#64748b';
      ctx.font = '9px JetBrains Mono, monospace';
      ctx.fillText(`${z}km`, 8, y + 3);
    }

    // Vertical temperature lines (-60, -40, -20, 0, +20 °C)
    for (let t = -60; t <= 30; t += 20) {
      const x = tToX(t);
      ctx.beginPath();
      ctx.moveTo(x, 20);
      ctx.lineTo(x, HEIGHT - 32);
      ctx.stroke();

      ctx.fillStyle = t === 0 ? '#0ea5e9' : '#64748b';
      ctx.font = t === 0 ? 'bold 9px JetBrains Mono, monospace' : '9px JetBrains Mono, monospace';
      ctx.fillText(`${t}°`, x - 8, HEIGHT - 18);
    }

    // 2. 0°C Vertical Reference Line (Linha de Congelamento)
    const x0 = tToX(0);
    ctx.strokeStyle = '#0ea5e9';
    ctx.lineWidth = 1.8;
    ctx.setLineDash([5, 4]);
    ctx.beginPath();
    ctx.moveTo(x0, 20);
    ctx.lineTo(x0, HEIGHT - 32);
    ctx.stroke();
    ctx.setLineDash([]);

    // Shaded warm melting zone (T > 0°C)
    ctx.fillStyle = 'rgba(239, 68, 68, 0.08)';
    ctx.fillRect(x0, 20, WIDTH - 20 - x0, HEIGHT - 52);

    // 3. Draw Dew Point Curve (Linha Amarela NOAA)
    ctx.strokeStyle = '#eab308';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    soundingNodes.forEach((node, idx) => {
      const x = tToX(node.dewPointC);
      const y = zToY(node.zKm);
      if (idx === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // 4. Draw Air Temperature Curve (Linha Verde NOAA)
    ctx.strokeStyle = '#22c55e';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    soundingNodes.forEach((node, idx) => {
      const x = tToX(node.tempC);
      const y = zToY(node.zKm);
      if (idx === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // 5. Draggable Handles for 4 Levels
    soundingNodes.forEach((node, idx) => {
      const y = zToY(node.zKm);

      // Yellow handle (Td)
      const xTd = tToX(node.dewPointC);
      ctx.beginPath();
      ctx.arc(xTd, y, 5.0, 0, Math.PI * 2);
      ctx.fillStyle = '#eab308';
      ctx.fill();
      ctx.strokeStyle = '#713f12';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Green handle (T)
      const xT = tToX(node.tempC);
      ctx.beginPath();
      ctx.arc(xT, y, 5.5, 0, Math.PI * 2);
      ctx.fillStyle = '#22c55e';
      ctx.fill();
      ctx.strokeStyle = '#14532d';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Level altitude tag
      ctx.fillStyle = '#cbd5e1';
      ctx.font = 'bold 9px JetBrains Mono, monospace';
      ctx.fillText(`L${idx + 1}`, WIDTH - 18, y + 3);
    });
  }, [soundingNodes]);

  // Mouse drag handlers on canvas
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = ((e.clientX - rect.left) / rect.width) * WIDTH;
    const my = ((e.clientY - rect.top) / rect.height) * HEIGHT;

    let bestDist = 18.0;
    let target: { index: number; isDewPoint: boolean } | null = null;

    soundingNodes.forEach((node, idx) => {
      const y = zToY(node.zKm);
      const xT = tToX(node.tempC);
      const xTd = tToX(node.dewPointC);

      const distT = Math.hypot(mx - xT, my - y);
      const distTd = Math.hypot(mx - xTd, my - y);

      if (distT < bestDist) {
        bestDist = distT;
        target = { index: idx, isDewPoint: false };
      }
      if (distTd < bestDist) {
        bestDist = distTd;
        target = { index: idx, isDewPoint: true };
      }
    });

    if (target) {
      setActiveDrag(target);
    }
  };

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!activeDrag || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const mx = ((e.clientX - rect.left) / rect.width) * WIDTH;
    const my = ((e.clientY - rect.top) / rect.height) * HEIGHT;

    const newTemp = Math.round(Math.max(-70, Math.min(35, xToT(mx))));
    const node = soundingNodes[activeDrag.index];

    // Optional altitude drag for mid levels
    let newZ = node.zKm;
    if (activeDrag.index === 1 || activeDrag.index === 2) {
      newZ = Math.round(yToZ(my) * 10) / 10;
    }

    if (activeDrag.isDewPoint) {
      // Dragging Dew Point: strictly clamp Td <= T
      const validTd = Math.min(node.tempC, newTemp);
      setSoundingNode(activeDrag.index, node.tempC, validTd, newZ);
    } else {
      // Dragging Air Temp: if T falls below Td, push Td down
      const validTd = Math.min(newTemp, node.dewPointC);
      setSoundingNode(activeDrag.index, newTemp, validTd, newZ);
    }
  }, [activeDrag, soundingNodes, setSoundingNode]);

  const handleMouseUp = () => {
    setActiveDrag(null);
  };

  return (
    <div className="bg-slate-900/95 backdrop-blur-md border border-slate-800 rounded-2xl p-3.5 shadow-xl space-y-3 text-xs">
      {/* Header with NOAA Precipitation Diagnosis Badge */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
        <div>
          <h3 className="font-bold text-white flex items-center gap-1.5 text-xs">
            <Layers className="w-3.5 h-3.5 text-cyan-400" /> Perfil Termodinâmico (4 Níveis NOAA)
          </h3>
          <p className="text-[10px] text-slate-400 mt-0.5">
            <span className="text-emerald-400 font-semibold">Verde: T</span> •{' '}
            <span className="text-yellow-400 font-semibold">Amarelo: Td (Td ≤ T)</span> •{' '}
            <span className="text-cyan-400 font-semibold">Tracejado: 0°C</span>
          </p>
        </div>

        {/* NOAA Ground Diagnosis Badge */}
        <div className="text-right">
          <span className={`px-2.5 py-1 rounded-lg text-xs font-bold border shadow-sm ${
            diagnosis.type === 'neve'
              ? 'bg-blue-950 border-blue-600 text-blue-300'
              : diagnosis.type === 'chuva'
              ? 'bg-cyan-950 border-cyan-600 text-cyan-300'
              : diagnosis.type === 'sleet'
              ? 'bg-indigo-950 border-indigo-500 text-indigo-300'
              : 'bg-amber-950 border-amber-600 text-amber-300'
          }`}>
            {diagnosis.name}
          </span>
        </div>
      </div>

      {/* Interactive Sounding Canvas */}
      <div className="relative rounded-xl overflow-hidden border border-slate-800 bg-slate-950">
        <canvas
          ref={canvasRef}
          width={WIDTH}
          height={HEIGHT}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          className="w-full h-auto block cursor-crosshair select-none"
        />
        <div className="absolute bottom-1 right-2 text-[9px] text-slate-500 pointer-events-none font-mono">
          Arraste os pontos T / Td
        </div>
      </div>

      {/* NOAA Didactic Diagnosis Explanation */}
      <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800/80 text-[11px] leading-relaxed text-slate-300">
        <strong className="text-white flex items-center gap-1 mb-1">
          <Info className="w-3 h-3 text-cyan-400" /> Diagnóstico da Precipitação:
        </strong>
        <p className="text-slate-400">{diagnosis.description}</p>
      </div>

      {/* 4 Interactive Level Sliders & Numerical Readouts */}
      <div className="space-y-2 pt-1 border-t border-slate-800">
        <div className="flex justify-between items-center text-[11px] font-bold text-slate-300 uppercase tracking-wider">
          <span>Ajuste Numérico dos 4 Níveis</span>
          <span className="text-slate-500 font-normal">Td ≤ T garantido</span>
        </div>

        {soundingNodes.map((node, idx) => {
          const depression = Math.max(0, node.tempC - node.dewPointC);
          const isMoist = depression <= 3.0;

          return (
            <div key={idx} className="p-2 rounded-xl bg-slate-950/70 border border-slate-800/80 space-y-1.5">
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-semibold text-slate-200">
                  Nível {idx + 1}: <strong className="text-cyan-300">{node.zKm.toFixed(1)} km</strong>
                </span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded font-mono ${
                  isMoist ? 'bg-cyan-950 text-cyan-300 border border-cyan-800' : 'bg-slate-800 text-slate-400'
                }`}>
                  {isMoist ? '☁️ Saturado (Nuvem)' : '☀️ Camada Seca'}
                </span>
                <div className="flex gap-2 font-mono text-[11px]">
                  <span className="text-emerald-400 font-bold">T: {node.tempC.toFixed(0)}°C</span>
                  <span className="text-yellow-400 font-bold">Td: {node.dewPointC.toFixed(0)}°C</span>
                </div>
              </div>

              {/* Slider for T */}
              <div className="grid grid-cols-2 gap-2 text-[10px]">
                <div>
                  <div className="flex justify-between text-slate-400 mb-0.5">
                    <span>Temp. Ar (T):</span>
                    <strong className="text-emerald-400">{node.tempC.toFixed(0)}°C</strong>
                  </div>
                  <input
                    type="range"
                    min="-60"
                    max="35"
                    step="1"
                    value={node.tempC}
                    onChange={(e) => {
                      const newT = parseFloat(e.target.value);
                      const validTd = Math.min(newT, node.dewPointC);
                      setSoundingNode(idx, newT, validTd);
                    }}
                    className="w-full h-1 bg-slate-800 rounded accent-emerald-500 cursor-pointer"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-slate-400 mb-0.5">
                    <span>Pto. Orvalho (Td):</span>
                    <strong className="text-yellow-400">{node.dewPointC.toFixed(0)}°C</strong>
                  </div>
                  <input
                    type="range"
                    min="-65"
                    max={node.tempC}
                    step="1"
                    value={node.dewPointC}
                    onChange={(e) => {
                      const newTd = parseFloat(e.target.value);
                      const validTd = Math.min(node.tempC, newTd);
                      setSoundingNode(idx, node.tempC, validTd);
                    }}
                    className="w-full h-1 bg-slate-800 rounded accent-yellow-500 cursor-pointer"
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
