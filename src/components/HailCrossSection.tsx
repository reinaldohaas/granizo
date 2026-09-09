import React, { useEffect, useRef } from 'react';
import { useSimulationStore } from '../store/simulationStore';
import { GrowthRegime } from '../types/simulationTypes';
import { X } from 'lucide-react';

export const HailCrossSection: React.FC = () => {
  const isOpen = useSimulationStore((state) => state.showCrossSectionModal);
  const toggleModal = useSimulationStore((state) => state.toggleCrossSectionModal);
  const tel = useSimulationStore((state) => state.selectedTelemetry);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!isOpen || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const maxR = canvas.width * 0.42;

    const layers = tel?.layerHistory || [
      { thicknessMm: 3.0, regime: GrowthRegime.DRY, temperatureC: -12, altitudeKm: 5, timestamp: 0 }
    ];
    const numLayers = Math.max(1, layers.length);

    // Draw concentric growth rings from outer to inner
    for (let i = numLayers; i >= 1; i--) {
      const ringR = (maxR / numLayers) * i;
      const rec = layers[i - 1];
      const isGlaze = rec?.regime === GrowthRegime.WET;

      ctx.beginPath();
      ctx.arc(centerX, centerY, ringR, 0, Math.PI * 2);

      if (i === 1) {
        // Core graupel embryo
        ctx.fillStyle = '#cbd5e1';
        ctx.fill();
        ctx.strokeStyle = '#64748b';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      } else if (isGlaze) {
        // Glaze (Wet growth): clear, translucent cyan ice
        ctx.fillStyle = 'rgba(56, 189, 248, 0.28)';
        ctx.fill();
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 2.0;
        ctx.stroke();
      } else {
        // Rime (Dry growth): milky opaque white with air microbubbles
        ctx.fillStyle = 'rgba(255, 255, 255, 0.88)';
        ctx.fill();
        ctx.strokeStyle = '#e2e8f0';
        ctx.lineWidth = 2.2;
        ctx.stroke();

        // Trapped microbubbles
        for (let b = 0; b < 8; b++) {
          const angle = (b / 8) * Math.PI * 2 + i * 1.5;
          const br = ringR * 0.85;
          ctx.beginPath();
          ctx.arc(centerX + Math.cos(angle) * br, centerY + Math.sin(angle) * br, 1.4, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(148, 163, 184, 0.7)';
          ctx.fill();
        }
      }
    }

    // Reticle crosshair
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.3)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(centerX - 15, centerY); ctx.lineTo(centerX + 15, centerY);
    ctx.moveTo(centerX, centerY - 15); ctx.lineTo(centerX, centerY + 15);
    ctx.stroke();
  }, [isOpen, tel]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
        
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <span>🔬</span> Corte Microscópico da Pedra #{tel?.id || '--'}
            </h3>
            <p className="text-xs text-slate-400">Anéis concêntricos formados pelas sucessivas recirculações.</p>
          </div>
          <button
            onClick={() => toggleModal(false)}
            className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex justify-center py-2">
          <canvas ref={canvasRef} width={300} height={300} className="bg-slate-950 rounded-xl border border-slate-800 shadow-inner" />
        </div>

        <div className="bg-slate-950 border border-slate-800 rounded-xl p-3.5 space-y-2 text-xs">
          <div className="flex justify-between font-mono">
            <span className="text-slate-400">Diâmetro Total:</span>
            <strong className="text-white">{tel?.diameterMm.toFixed(1)} mm</strong>
          </div>
          <div className="flex justify-between font-mono">
            <span className="text-slate-400">Camadas Registradas:</span>
            <strong className="text-amber-400">{tel?.layers || 1} camadas</strong>
          </div>
          <div className="pt-2 border-t border-slate-800 text-[11px] text-slate-300 space-y-1">
            <p>• <strong>Camadas Brancas (Rime):</strong> Crescimento seco em temperaturas muito frias (&lt; -16°C), aprisionando microbolhas.</p>
            <p>• <strong>Camadas Límpidas (Glaze):</strong> Crescimento úmido próximo a 0°C com alta água líquida; água escorre antes de congelar devagar.</p>
          </div>
        </div>

        <button
          onClick={() => toggleModal(false)}
          className="w-full py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold shadow transition"
        >
          Fechar
        </button>

      </div>
    </div>
  );
};
