import React, { useRef, useState, useEffect } from 'react';
import { useSimulationStore } from '../store/simulationStore';
import { SoundingNode } from '../types/simulationTypes';
import { Thermometer, Droplets, Info } from 'lucide-react';

export const AtmosphericSounding: React.FC = () => {
  const soundingNodes = useSimulationStore((state) => state.params.soundingNodes);
  const setSoundingNode = useSimulationStore((state) => state.setSoundingNode);
  const wMax = useSimulationStore((state) => state.params.wMax);
  const zFreezingKm = useSimulationStore((state) => state.params.zFreezingKm);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [activeDrag, setActiveDrag] = useState<{ index: number; isDewPoint: boolean } | null>(null);

  // Coordinate mapping:
  // Temperature: -65°C to +35°C mapped to width [40, width - 20]
  // Altitude: 0 to 14 km mapped to height [height - 30, 20]
  const WIDTH = 340;
  const HEIGHT = 260;

  const tToX = (t: number) => 40 + ((t + 65.0) / 100.0) * (WIDTH - 60);
  const xToT = (x: number) => -65.0 + ((x - 40) / (WIDTH - 60)) * 100.0;

  const zToY = (z: number) => (HEIGHT - 30) - (z / 14.0) * (HEIGHT - 50);

  // Draw sounding diagram
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, WIDTH, HEIGHT);

    // 1. Grid & Axes
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;

    // Altitude horizontal grid lines (0, 3, 6, 9, 12 km)
    for (let z = 0; z <= 14; z += 3) {
      const y = zToY(z);
      ctx.beginPath();
      ctx.moveTo(40, y);
      ctx.lineTo(WIDTH - 20, y);
      ctx.stroke();

      ctx.fillStyle = '#64748b';
      ctx.font = '9px JetBrains Mono, monospace';
      ctx.fillText(`${z} km`, 5, y + 3);
    }

    // Temperature vertical grid lines (-60, -40, -20, 0, +20 °C)
    for (let t = -60; t <= 30; t += 20) {
      const x = tToX(t);
      ctx.beginPath();
      ctx.moveTo(x, 20);
      ctx.lineTo(x, HEIGHT - 30);
      ctx.stroke();

      ctx.fillStyle = t === 0 ? '#0ea5e9' : '#64748b';
      ctx.font = t === 0 ? 'bold 9px JetBrains Mono, monospace' : '9px JetBrains Mono, monospace';
      ctx.fillText(`${t}°`, x - 8, HEIGHT - 16);
    }

    // Freezing reference line (0°C)
    const x0 = tToX(0);
    ctx.strokeStyle = '#0ea5e9';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(x0, 20);
    ctx.lineTo(x0, HEIGHT - 30);
    ctx.stroke();
    ctx.setLineDash([]);

    // 2. Warm Layer tint (where T > 0°C)
    ctx.fillStyle = 'rgba(239, 68, 68, 0.08)';
    ctx.fillRect(x0, zToY(zFreezingKm), WIDTH - 20 - x0, zToY(0) - zToY(zFreezingKm));

    // 3. Draw Dew Point Curve (Linha Amarela NOAA)
    ctx.strokeStyle = '#eab308';
    ctx.lineWidth = 2.0;
    ctx.beginPath();
    soundingNodes.forEach((node, idx) => {
      const x = tToX(node.dewPointC);
      const y = zToY(node.zKm);
      if (idx === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Dew Point interactive handles
    soundingNodes.forEach((node) => {
      const x = tToX(node.dewPointC);
      const y = zToY(node.zKm);
      ctx.beginPath();
      ctx.arc(x, y, 4.5, 0, Math.PI * 2);
      ctx.fillStyle = '#eab308';
      ctx.fill();
      ctx.strokeStyle = '#713f12';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    });

    // 4. Draw Air Temperature Curve (Linha Verde NOAA)
    ctx.strokeStyle = '#22c55e';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    soundingNodes.forEach((node, idx) => {
      const x = tToX(node.tempC);
      const y = zToY(node.zKm);
      if (idx === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Temperature interactive handles
    soundingNodes.forEach((node) => {
      const x = tToX(node.tempC);
      const y = zToY(node.zKm);
      ctx.beginPath();
      ctx.arc(x, y, 5, 0, Math.PI * 2);
      ctx.fillStyle = '#22c55e';
      ctx.fill();
      ctx.strokeStyle = '#14532d';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    });
  }, [soundingNodes, zFreezingKm]);

  // Drag interaction
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    for (let i = 0; i < soundingNodes.length; i++) {
      const node = soundingNodes[i];
      const yPx = zToY(node.zKm);
      const xTemp = tToX(node.tempC);
      const xDew = tToX(node.dewPointC);

      // Check click on temperature handle
      if (Math.hypot(clickX - xTemp, clickY - yPx) < 10) {
        setActiveDrag({ index: i, isDewPoint: false });
        return;
      }
      // Check click on dew point handle
      if (Math.hypot(clickX - xDew, clickY - yPx) < 10) {
        setActiveDrag({ index: i, isDewPoint: true });
        return;
      }
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!activeDrag || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const mouseX = Math.max(40, Math.min(WIDTH - 20, e.clientX - rect.left));
    const newT = Math.round(xToT(mouseX) * 10) / 10;

    const node = soundingNodes[activeDrag.index];
    if (activeDrag.isDewPoint) {
      setSoundingNode(activeDrag.index, node.tempC, newT);
    } else {
      setSoundingNode(activeDrag.index, newT, Math.min(newT, node.dewPointC));
    }
  };

  const handleMouseUp = () => setActiveDrag(null);

  // Determine dominant NOAA Precipitation Type at ground
  const surfTemp = soundingNodes[0].tempC;
  const isAllFreezing = soundingNodes.every((n) => n.tempC <= 0);
  let noaaPrecipType = 'Chuva (Rain)';
  let noaaColor = 'text-blue-400 bg-blue-950 border-blue-800';
  let noaaDesc = 'A camada quente acima de 0°C derrete todo o gelo antes de atingir o solo.';

  if (isAllFreezing) {
    noaaPrecipType = 'Neve (Snow)';
    noaaColor = 'text-cyan-200 bg-cyan-950 border-cyan-800';
    noaaDesc = 'Toda a coluna atmosférica está abaixo de 0°C; cristais chegam ao solo como flocos de neve.';
  } else if (surfTemp < 0 && soundingNodes.some((n) => n.tempC > 0)) {
    noaaPrecipType = 'Chuva Congelante / Sleet';
    noaaColor = 'text-purple-300 bg-purple-950 border-purple-800';
    noaaDesc = 'Camada quente em altitude derrete as pedras, que recongelam na camada fria próxima ao solo.';
  } else if (wMax >= 25 && zFreezingKm <= 3.6) {
    noaaPrecipType = 'Granizo Severo (Hail)';
    noaaColor = 'text-amber-400 bg-amber-950 border-amber-800';
    noaaDesc = 'Corrente ascendente vigorosa suspende granizo volumoso que sobrevive à travessia da camada quente.';
  }

  return (
    <div className="bg-slate-900/95 border border-slate-800 rounded-2xl p-4 shadow-xl space-y-3">
      
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-2 text-xs">
        <div className="flex items-center gap-1.5">
          <span className="text-base">📈</span>
          <h3 className="font-bold text-white uppercase tracking-wider text-xs">
            Perfil Termodinâmico (Estilo NOAA NESDIS)
          </h3>
        </div>
        <span className="text-[10px] text-slate-400 font-mono">Arraste os nós</span>
      </div>

      {/* NOAA Style Draggable Sounding Canvas */}
      <div className="bg-slate-950 border border-slate-800 rounded-xl p-2 relative flex flex-col items-center">
        <canvas
          ref={canvasRef}
          width={WIDTH}
          height={HEIGHT}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          className="cursor-ew-resize select-none"
        />

        {/* Legend for lines */}
        <div className="flex items-center justify-center gap-4 text-[11px] pt-1">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-1 bg-green-500 rounded inline-block"></span>
            <span className="text-green-400 font-semibold flex items-center gap-1">
              <Thermometer className="w-3 h-3" /> Temperatura (T)
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-1 bg-yellow-500 rounded inline-block"></span>
            <span className="text-yellow-400 font-semibold flex items-center gap-1">
              <Droplets className="w-3 h-3" /> Ponto de Orvalho (T<sub>d</sub>)
            </span>
          </div>
        </div>
      </div>

      {/* Real-time NOAA Precipitation Type Diagnostic */}
      <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 space-y-1.5 text-xs">
        <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
          Precipitação na Superfície (Classificação NOAA):
        </span>
        
        <div className="flex items-center justify-between">
          <span className={`px-2.5 py-1 rounded-lg font-bold border text-xs ${noaaColor}`}>
            {noaaPrecipType}
          </span>
          <span className="font-mono text-slate-400 text-[11px]">
            Nível 0°C: <strong className="text-cyan-400">{zFreezingKm.toFixed(1)} km</strong>
          </span>
        </div>

        <p className="text-[11px] text-slate-400 leading-relaxed pt-1">
          {noaaDesc}
        </p>
      </div>

    </div>
  );
};
