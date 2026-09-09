import React, { useEffect, useRef, useCallback } from 'react';
import { useSimulationStore } from '../store/simulationStore';
import { SimulationEngine } from '../simulation/SimulationEngine';
import { ParticleType, GrowthRegime, ScenarioPreset } from '../types/simulationTypes';


function drawArrow(
  ctx: CanvasRenderingContext2D,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  headLen: number = 8
) {
  const dx = toX - fromX;
  const dy = toY - fromY;
  const angle = Math.atan2(dy, dx);
  ctx.beginPath();
  ctx.moveTo(fromX, fromY);
  ctx.lineTo(toX, toY);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(toX, toY);
  ctx.lineTo(toX - headLen * Math.cos(angle - Math.PI / 6), toY - headLen * Math.sin(angle - Math.PI / 6));
  ctx.lineTo(toX - headLen * Math.cos(angle + Math.PI / 6), toY - headLen * Math.sin(angle + Math.PI / 6));
  ctx.closePath();
  ctx.fill();
}

export const SimulationCanvas: React.FC = () => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<SimulationEngine | null>(null);

  const params = useSimulationStore((state) => state.params);
  const activeScenario = useSimulationStore((state) => state.activeScenario);
  const resetEpoch = useSimulationStore((state) => state.resetEpoch);
  const selectedParticleId = useSimulationStore((state) => state.selectedParticleId);

  const selectParticle = useSimulationStore((state) => state.selectParticle);
  const updateTelemetry = useSimulationStore((state) => state.updateTelemetry);
  const updateGroundStats = useSimulationStore((state) => state.updateGroundStats);
  const setStormMinutes = useSimulationStore((state) => state.setStormMinutes);
  const toggleAutoEvolveStorm = useSimulationStore((state) => state.toggleAutoEvolveStorm);
  const setStormEvolutionRate = useSimulationStore((state) => state.setStormEvolutionRate);
  const [showDiagramModal, setShowDiagramModal] = React.useState(false);
  const [multicellHighlight, setMulticellHighlight] = React.useState<'all' | 'IV' | 'III' | 'II' | 'I' | 'gust_front'>('all');
  const [showMulticellModal, setShowMulticellModal] = React.useState(false);

  // Mandatory complete rebuild when resetEpoch changes
  useEffect(() => {
    if (engineRef.current) {
      engineRef.current.resetScenario(activeScenario);
    } else {
      engineRef.current = new SimulationEngine(params);
    }
  }, [resetEpoch, activeScenario]);

  // Keep engine params synchronized
  useEffect(() => {
    if (engineRef.current) {
      engineRef.current.params = { ...params };
    }
  }, [params]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    let animFrameId: number;
    let lastTime = performance.now();
    let lastReactSync = 0;
    let animClock = 0;

    const render = (now: number) => {
      const dtSec = Math.min(0.05, (now - lastTime) / 1000.0);
      lastTime = now;
      animClock += dtSec;

      const engine = engineRef.current;
      if (!engine) {
        animFrameId = requestAnimationFrame(render);
        return;
      }

      if (useSimulationStore.getState().isRunning) {
        engine.update(dtSec);
      }

      // Sync React state throttled to ~10 Hz
      if (now - lastReactSync > 100) {
        lastReactSync = now;
        const selIdx = useSimulationStore.getState().selectedParticleId - 1;
        if (selIdx >= 0 && selIdx < engine.particles.activeCount) {
          const z = engine.particles.positionsZ[selIdx];
          const T = engine.atmos.getTemperature(z, engine.params.zFreezingKm, engine.params.soundingNodes);
          const Td = engine.atmos.getDewPoint(z, engine.params.soundingNodes);
          const { w } = engine.wind.evaluate(engine.particles.positionsX[selIdx], z, engine.simTimeSec, engine.params);
          const rhoAir = engine.atmos.getAirDensity(z);
          const diam = engine.particles.diameters[selIdx];
          const vt = 9.0 * Math.sqrt(Math.max(0.1, diam / 10.0)) * Math.sqrt(1.225 / rhoAir);
          updateTelemetry(engine.particles.getTelemetry(selIdx, T, Td, w, vt));
        }
        updateGroundStats(engine.groundStats);
      }

      const width = canvas.width;
      const height = canvas.height;

      const groundY = height - 44;
      const topY = 28;
      const maxZKm = 16.0;
      const kmToX = (xKm: number) => (xKm / 22.0) * width;
      const kmToY = (zKm: number) => groundY - (zKm / maxZKm) * (groundY - topY);

      // 1. Sky Gradient Background
      const skyGrad = ctx.createLinearGradient(0, 0, 0, height);
      skyGrad.addColorStop(0, '#020617');
      skyGrad.addColorStop(0.65, '#0b1120');
      skyGrad.addColorStop(1, '#0f172a');
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, width, height);

      // 2. Warm Melting Zone (T > 0°C) and Freezing Reference
      const fzY = kmToY(engine.params.zFreezingKm);
      ctx.fillStyle = 'rgba(239, 68, 68, 0.04)';
      ctx.fillRect(0, fzY, width, groundY - fzY);

      // 3. Draw 0°C Freezing Line
      if (useSimulationStore.getState().showIsotherms) {
        ctx.lineWidth = 1.2;
        ctx.strokeStyle = 'rgba(14, 165, 233, 0.85)';
        ctx.setLineDash([6, 4]);
        ctx.beginPath();
        ctx.moveTo(0, fzY);
        ctx.lineTo(width, fzY);
        ctx.stroke();

        ctx.fillStyle = '#38bdf8';
        ctx.font = 'bold 10px JetBrains Mono, monospace';
        ctx.fillText(`0°C (${engine.params.zFreezingKm.toFixed(1)} km) - Nível de Fusão/Congelamento`, 36, fzY - 4);
        ctx.setLineDash([]);
      }

      // Height (km) Axis on the left (matching the scientific diagram: 0, 5, 10, 15 km)
      ctx.save();
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.4)';
      ctx.lineWidth = 1.0;
      ctx.beginPath();
      ctx.moveTo(kmToX(0.7), kmToY(0));
      ctx.lineTo(kmToX(0.7), kmToY(15.2));
      ctx.stroke();

      const heightTicks = [0, 5, 10, 15];
      ctx.font = 'bold 9px JetBrains Mono, monospace';
      ctx.fillStyle = '#94a3b8';
      for (const hKm of heightTicks) {
        const y = kmToY(hKm);
        ctx.beginPath();
        ctx.moveTo(kmToX(0.4), y);
        ctx.lineTo(kmToX(0.7), y);
        ctx.stroke();
        ctx.fillText(`${hKm}`, kmToX(0.12), y + 3);
      }
      ctx.save();
      ctx.translate(kmToX(0.28), kmToY(7.5));
      ctx.rotate(-Math.PI / 2);
      ctx.textAlign = 'center';
      ctx.fillStyle = '#cbd5e1';
      ctx.font = 'bold 9px JetBrains Mono, monospace';
      ctx.fillText('Height (km)', 0, -8);
      ctx.restore();
      ctx.restore();

      // 4. METEOROLOGICALLY COHERENT CLOUD DRAWING FOR ALL 7 SCENARIOS
      const scenario = engine.params.activeScenario;
      const isConvective = engine.params.family === 'convective';

      ctx.save();

      if (scenario === 'neve') {
        // Nimbostratus amplo e estratiforme (Neve)
        ctx.fillStyle = 'rgba(30, 41, 59, 0.72)';
        ctx.beginPath();
        ctx.moveTo(kmToX(1.0), kmToY(1.8));
        ctx.bezierCurveTo(kmToX(6.0), kmToY(2.2), kmToX(16.0), kmToY(2.0), kmToX(21.0), kmToY(1.8));
        ctx.lineTo(kmToX(21.0), kmToY(8.5));
        ctx.bezierCurveTo(kmToX(16.0), kmToY(8.2), kmToX(6.0), kmToY(8.6), kmToX(1.0), kmToY(8.4));
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = 'rgba(148, 163, 184, 0.3)';
        ctx.stroke();

        ctx.fillStyle = 'rgba(203, 213, 225, 0.6)';
        ctx.font = 'bold 11px JetBrains Mono, monospace';
        ctx.fillText('Nimbostratus Amplo Estratiforme (Neve)', kmToX(2.0), kmToY(8.0));

      } else if (scenario === 'chuva') {
        // Nimbostratus com base escura (Chuva)
        const darkGrad = ctx.createLinearGradient(0, kmToY(8.0), 0, kmToY(1.2));
        darkGrad.addColorStop(0, 'rgba(51, 65, 85, 0.65)');
        darkGrad.addColorStop(1, 'rgba(15, 23, 42, 0.95)'); // Very dark base
        ctx.fillStyle = darkGrad;
        ctx.beginPath();
        ctx.moveTo(kmToX(1.5), kmToY(1.2));
        ctx.bezierCurveTo(kmToX(7.0), kmToY(1.6), kmToX(15.0), kmToY(1.4), kmToX(20.5), kmToY(1.2));
        ctx.lineTo(kmToX(20.5), kmToY(7.8));
        ctx.bezierCurveTo(kmToX(14.0), kmToY(8.2), kmToX(6.0), kmToY(7.6), kmToX(1.5), kmToY(7.8));
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = 'rgba(71, 85, 105, 0.5)';
        ctx.stroke();

        ctx.fillStyle = 'rgba(203, 213, 225, 0.6)';
        ctx.font = 'bold 11px JetBrains Mono, monospace';
        ctx.fillText('Nimbostratus com Base Escura (Chuva Estratiforme)', kmToX(2.0), kmToY(7.4));

      } else if (scenario === 'sleet') {
        // Nimbostratus associado ao perfil com camada quente de fusão (Pelotas de Gelo)
        ctx.fillStyle = 'rgba(30, 41, 59, 0.78)';
        ctx.beginPath();
        ctx.moveTo(kmToX(1.5), kmToY(2.2));
        ctx.bezierCurveTo(kmToX(8.0), kmToY(2.6), kmToX(14.0), kmToY(2.0), kmToX(20.5), kmToY(2.2));
        ctx.lineTo(kmToX(20.5), kmToY(8.8));
        ctx.bezierCurveTo(kmToX(15.0), kmToY(9.0), kmToX(6.0), kmToY(8.4), kmToX(1.5), kmToY(8.6));
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = 'rgba(99, 102, 241, 0.4)';
        ctx.stroke();

        // Shaded warm nose band in mid levels
        ctx.fillStyle = 'rgba(239, 68, 68, 0.08)';
        ctx.fillRect(kmToX(1.5), kmToY(5.2), kmToX(19.0), kmToY(3.8) - kmToY(5.2));

        // Shaded cold refreezing layer below
        ctx.fillStyle = 'rgba(99, 102, 241, 0.12)';
        ctx.fillRect(kmToX(1.5), kmToY(2.2), kmToX(19.0), groundY - kmToY(2.2));

        ctx.fillStyle = '#a5b4fc';
        ctx.font = 'bold 11px JetBrains Mono, monospace';
        ctx.fillText('Nimbostratus Frontal (Pelotas de Gelo / Sleet)', kmToX(2.0), kmToY(8.2));
        ctx.font = '9px JetBrains Mono, monospace';
        ctx.fillText('▲ Camada Quente (Neve derrete em gota) | ▼ Camada Fria Profunda (Gota recongela em pelota de gelo)', kmToX(2.0), kmToY(4.5));

      } else if (scenario === 'chuva_congelante') {
        // Nimbostratus amplo e baixo (Chuva Congelante)
        const lowGrad = ctx.createLinearGradient(0, kmToY(7.5), 0, kmToY(0.7));
        lowGrad.addColorStop(0, 'rgba(51, 65, 85, 0.65)');
        lowGrad.addColorStop(1, 'rgba(15, 23, 42, 0.95)');
        ctx.fillStyle = lowGrad;
        ctx.beginPath();
        ctx.moveTo(kmToX(1.0), kmToY(0.7));
        ctx.bezierCurveTo(kmToX(7.0), kmToY(0.9), kmToX(15.0), kmToY(0.8), kmToX(21.0), kmToY(0.7));
        ctx.lineTo(kmToX(21.0), kmToY(7.5));
        ctx.bezierCurveTo(kmToX(14.0), kmToY(7.8), kmToX(6.0), kmToY(7.2), kmToX(1.0), kmToY(7.4));
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.4)';
        ctx.stroke();

        // Shaded shallow cold surface pool
        ctx.fillStyle = 'rgba(56, 189, 248, 0.14)';
        ctx.fillRect(kmToX(1.0), kmToY(0.9), kmToX(20.0), groundY - kmToY(0.9));

        ctx.fillStyle = '#67e8f9';
        ctx.font = 'bold 11px JetBrains Mono, monospace';
        ctx.fillText('Nimbostratus Baixo (Chuva Congelante / Freezing Rain)', kmToX(2.0), kmToY(7.0));
        ctx.font = '9px JetBrains Mono, monospace';
        ctx.fillText('▲ Fusão Completa na Camada Quente | ▼ Camada Fria Rasa (< 1 km): Gota super-resfria e congela no contato com o solo', kmToX(2.0), kmToY(3.8));

      } else if (scenario === 'tempestade_comum') {
        const tMin = engine.params.stormMinutes ?? 0.0;
        const xC = 9.0;

        // Dynamic cloud morphology based on Byers and Braham (1949)
        let zTop = 4.0;
        let zBase = 1.5;
        let wHalf = 1.8;
        let anvilSpread = 0;

        if (tMin <= 10.0) {
          const p = tMin / 10.0;
          zTop = 3.8 + p * 2.4;
          wHalf = 1.4 + p * 0.8;
        } else if (tMin <= 15.0) {
          const p = (tMin - 10.0) / 5.0;
          zTop = 6.2 + p * 3.0;
          wHalf = 2.2 + p * 0.5;
        } else if (tMin <= 22.0) {
          const p = (tMin - 15.0) / 7.0;
          zTop = 9.2 + Math.sin(p * Math.PI * 0.5) * 2.0;
          wHalf = 2.7;
          anvilSpread = 4.8 * Math.min(1.0, p * 1.3);
        } else if (tMin <= 27.0) {
          const p = (tMin - 22.0) / 5.0;
          zTop = 11.0 - p * 0.5;
          wHalf = 2.5 - p * 0.4;
          anvilSpread = 4.5;
        } else {
          const p = (tMin - 27.0) / 3.0;
          zTop = 10.5;
          zBase = 1.5 + p * 1.8;
          wHalf = 2.1 - p * 0.5;
          anvilSpread = 4.2;
        }

        // 1. Draw Cloud Silhouette
        ctx.fillStyle = 'rgba(24, 32, 47, 0.88)';
        ctx.beginPath();

        if (anvilSpread > 0.5) {
          const anvilLeft = xC - wHalf - anvilSpread;
          const anvilRight = xC + wHalf + anvilSpread;
          const anvilY = kmToY(zTop - 0.7);

          ctx.moveTo(kmToX(xC - wHalf), kmToY(zBase));
          ctx.bezierCurveTo(kmToX(xC - wHalf - 0.8), kmToY(zBase + (zTop - zBase) * 0.3), kmToX(xC - wHalf - 0.4), kmToY(zTop - 2.5), kmToX(anvilLeft), anvilY);
          ctx.bezierCurveTo(kmToX(anvilLeft + 1.0), kmToY(zTop - 0.2), kmToX(xC - 1.5), kmToY(zTop + 0.1), kmToX(xC), kmToY(zTop + 0.3));
          ctx.bezierCurveTo(kmToX(xC + 1.5), kmToY(zTop + 0.1), kmToX(anvilRight - 1.0), kmToY(zTop - 0.2), kmToX(anvilRight), anvilY);
          ctx.bezierCurveTo(kmToX(xC + wHalf + 0.4), kmToY(zTop - 2.5), kmToX(xC + wHalf + 0.8), kmToY(zBase + (zTop - zBase) * 0.3), kmToX(xC + wHalf), kmToY(zBase));
        } else {
          ctx.moveTo(kmToX(xC - wHalf), kmToY(zBase));
          ctx.bezierCurveTo(kmToX(xC - wHalf - 0.6), kmToY(zBase + (zTop - zBase) * 0.4), kmToX(xC - wHalf * 0.6), kmToY(zTop - 0.5), kmToX(xC), kmToY(zTop));
          ctx.bezierCurveTo(kmToX(xC + wHalf * 0.6), kmToY(zTop - 0.5), kmToX(xC + wHalf + 0.6), kmToY(zBase + (zTop - zBase) * 0.4), kmToX(xC + wHalf), kmToY(zBase));
        }

        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = tMin >= 27.0 ? 'rgba(148, 163, 184, 0.4)' : 'rgba(71, 85, 105, 0.6)';
        if (tMin >= 27.0) ctx.setLineDash([5, 4]);
        ctx.stroke();
        ctx.setLineDash([]);

        // 2. Concentric LWC Cores (1, 3, 5)
        // Core 1 (Laranja)
        if (tMin >= 4.0) {
          const c1Alpha = Math.min(0.45, ((tMin - 4.0) / 4.0) * 0.45);
          const c1Bottom = Math.max(zBase + 0.3, tMin >= 18.0 ? 0.0 : 2.2);
          const c1Top = Math.min(zTop - 0.8, tMin >= 15.0 ? 9.2 : zTop - 0.5);
          const c1CY = (c1Bottom + c1Top) / 2;
          const c1RY = (c1Top - c1Bottom) / 2;
          const c1RX = wHalf * 0.72;

          ctx.fillStyle = `rgba(249, 115, 22, ${c1Alpha})`;
          ctx.strokeStyle = `rgba(249, 115, 22, ${c1Alpha + 0.3})`;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.ellipse(kmToX(xC), kmToY(c1CY), c1RX * (width / 22), c1RY * (height / 14), 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = '#ea580c';
          ctx.font = 'bold 10px JetBrains Mono, monospace';
          ctx.fillText('1', kmToX(xC + c1RX * 0.75), kmToY(c1CY + c1RY * 0.4));
        }

        // Core 3 (Magenta)
        if (tMin >= 10.0) {
          const c3Alpha = Math.min(0.55, ((tMin - 10.0) / 4.0) * 0.55);
          const c3Bottom = Math.max(zBase + 0.6, tMin >= 20.0 ? 0.0 : 3.0);
          const c3Top = Math.min(zTop - 1.4, tMin >= 15.0 ? 7.8 : zTop - 0.9);
          const c3CY = (c3Bottom + c3Top) / 2;
          const c3RY = Math.max(0.5, (c3Top - c3Bottom) / 2);
          const c3RX = wHalf * 0.48;

          ctx.fillStyle = `rgba(236, 72, 153, ${c3Alpha})`;
          ctx.strokeStyle = `rgba(236, 72, 153, ${c3Alpha + 0.3})`;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.ellipse(kmToX(xC), kmToY(c3CY), c3RX * (width / 22), c3RY * (height / 14), 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = '#ec4899';
          ctx.font = 'bold 10px JetBrains Mono, monospace';
          ctx.fillText('3', kmToX(xC + c3RX * 0.7), kmToY(c3CY + c3RY * 0.3));
        }

        // Core 5 (Vermelho)
        if (tMin >= 16.0 && tMin <= 26.0) {
          const c5Alpha = Math.min(0.65, Math.sin(((tMin - 16.0) / 10.0) * Math.PI) * 0.65);
          const c5Bottom = tMin >= 20.0 ? 0.8 : 3.6;
          const c5Top = tMin >= 20.0 ? 6.5 : 6.8;
          const c5CY = (c5Bottom + c5Top) / 2;
          const c5RY = (c5Top - c5Bottom) / 2;
          const c5RX = wHalf * 0.25;

          ctx.fillStyle = `rgba(239, 68, 68, ${c5Alpha})`;
          ctx.strokeStyle = `rgba(239, 68, 68, ${c5Alpha + 0.3})`;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.ellipse(kmToX(xC), kmToY(c5CY), c5RX * (width / 22), c5RY * (height / 14), 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = '#ef4444';
          ctx.font = 'bold 10px JetBrains Mono, monospace';
          ctx.fillText('5', kmToX(xC + c5RX * 0.8), kmToY(c5CY));
        }

        // 3. Flow Vector Arrows on Canvas
        ctx.lineWidth = 1.6;
        if (tMin < 15.0) {
          ctx.strokeStyle = 'rgba(251, 191, 36, 0.75)';
          ctx.fillStyle = 'rgba(251, 191, 36, 0.75)';
          drawArrow(ctx, kmToX(xC), kmToY(zBase - 0.4), kmToX(xC), kmToY(zTop - 1.2));
          drawArrow(ctx, kmToX(xC - 1.2), kmToY(zBase - 0.4), kmToX(xC - 0.6), kmToY(zTop - 2.0));
          drawArrow(ctx, kmToX(xC + 1.2), kmToY(zBase - 0.4), kmToX(xC + 0.6), kmToY(zTop - 2.0));
        } else if (tMin <= 22.0) {
          ctx.strokeStyle = 'rgba(251, 191, 36, 0.8)';
          ctx.fillStyle = 'rgba(251, 191, 36, 0.8)';
          drawArrow(ctx, kmToX(xC), kmToY(7.0), kmToX(xC), kmToY(zTop - 0.3));
          drawArrow(ctx, kmToX(xC - 1.0), kmToY(8.0), kmToX(xC - anvilSpread * 0.6), kmToY(zTop - 0.8));
          drawArrow(ctx, kmToX(xC + 1.0), kmToY(8.0), kmToX(xC + anvilSpread * 0.6), kmToY(zTop - 0.8));

          ctx.strokeStyle = 'rgba(56, 189, 248, 0.85)';
          ctx.fillStyle = 'rgba(56, 189, 248, 0.85)';
          drawArrow(ctx, kmToX(xC - 0.8), kmToY(4.5), kmToX(xC - 1.4), kmToY(0.4));
          drawArrow(ctx, kmToX(xC + 0.8), kmToY(4.5), kmToX(xC + 1.4), kmToY(0.4));
        } else {
          ctx.strokeStyle = 'rgba(56, 189, 248, 0.85)';
          ctx.fillStyle = 'rgba(56, 189, 248, 0.85)';
          drawArrow(ctx, kmToX(xC), kmToY(6.5), kmToX(xC), kmToY(0.4));
          drawArrow(ctx, kmToX(xC - 1.0), kmToY(5.0), kmToX(xC - 1.8), kmToY(0.4));
          drawArrow(ctx, kmToX(xC + 1.0), kmToY(5.0), kmToX(xC + 1.8), kmToY(0.4));
        }

        // 4. Stage Title and Banner
        let stageName = '';
        if (tMin < 10.0) stageName = 'Estagio 1: Cumulus Inicial (0 - 10 min) • Updraft Puro, Sem Chuva';
        else if (tMin < 15.0) stageName = 'Estagio 2: Cumulus Congestus (10 - 15 min) • Torre Alta e Nucleos 1-3';
        else if (tMin <= 22.0) stageName = 'Estagio 3: Maduro / Auge (15 - 22 min) • Bigorna (11 km), Nucleo 5, Downdraft e Chuva';
        else if (tMin <= 27.0) stageName = 'Estagio 4: Inicio da Dissipacao (22 - 27 min) • Downdraft Sufoca o Updraft';
        else stageName = 'Estagio 5: Dissipacao Completa (27 - 30 min) • Bigorna Orfa e Fim da Chuva';

        ctx.fillStyle = '#f8fafc';
        ctx.font = 'bold 12px JetBrains Mono, monospace';
        ctx.fillText(`⏱️ ${tMin.toFixed(1)} min / 30 min • ${stageName}`, kmToX(1.5), kmToY(12.8));

        ctx.fillStyle = 'rgba(148, 163, 184, 0.8)';
        ctx.font = '10px JetBrains Mono, monospace';
        ctx.fillText('Modelo Classico Byers e Braham (1949) • Contornos 1, 3, 5 de Agua Liquida', kmToX(1.5), kmToY(12.3));
      } else if (scenario === 'tempestade_forte') {
        // =========================================================================
        // TEMPESTADE MUITO FORTE / MULTICELULAR COM LINHA DE FLANCO (IV, III, II, I)
        // Reprodução científica e didática fiel ao diagrama de referência:
        // Células IV, III, II (topo penetrante 15 km), Célula I (bigorna e downdraft),
        // frente de rajada com dentes de frente fria e contornos 10, 30, 50 dBZ.
        // =========================================================================

        // 1. Linha horizontal da base da nuvem (LCL ~ 2.5 km)
        ctx.strokeStyle = 'rgba(148, 163, 184, 0.45)';
        ctx.lineWidth = 1.0;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(kmToX(1.4), kmToY(2.5));
        ctx.lineTo(kmToX(10.5), kmToY(2.5));
        ctx.stroke();
        ctx.setLineDash([]);

        // 2. Silhueta Contínua das Nuvens Convectivas (IV, III, II e I)
        ctx.fillStyle = 'rgba(30, 41, 59, 0.88)';
        ctx.strokeStyle = 'rgba(100, 116, 139, 0.75)';
        ctx.lineWidth = 1.8;
        ctx.beginPath();

        // Início na base da Célula IV
        ctx.moveTo(kmToX(1.6), kmToY(2.5));
        // CÉLULA IV: Cúmulo na linha de flanco (topo ~ 6.0 km)
        ctx.bezierCurveTo(kmToX(1.4), kmToY(4.2), kmToX(2.0), kmToY(5.6), kmToX(2.8), kmToY(6.0));
        ctx.bezierCurveTo(kmToX(3.6), kmToY(6.3), kmToX(4.4), kmToY(5.8), kmToX(4.9), kmToY(5.0));
        // CÉLULA III: Cumulus congestus em forte crescimento vertical (topo ~ 10.5 km)
        ctx.bezierCurveTo(kmToX(5.3), kmToY(7.2), kmToX(5.8), kmToY(9.8), kmToX(7.0), kmToY(10.5));
        ctx.bezierCurveTo(kmToX(8.0), kmToY(10.6), kmToX(8.6), kmToY(9.2), kmToX(9.0), kmToY(8.6));
        // CÉLULA II: Célula madura vigorosa com Cúpula Penetrante / Overshooting Top (topo ~ 15.1 km)
        ctx.bezierCurveTo(kmToX(9.2), kmToY(11.5), kmToX(10.0), kmToY(13.8), kmToX(10.8), kmToY(14.8));
        ctx.bezierCurveTo(kmToX(11.4), kmToY(15.2), kmToX(12.2), kmToY(15.0), kmToX(12.8), kmToY(14.2));
        // Descida para a bigorna e CÉLULA I (topo bigorna ~ 13.8 km)
        ctx.bezierCurveTo(kmToX(13.6), kmToY(13.8), kmToX(15.5), kmToY(13.9), kmToX(18.0), kmToY(13.8));
        ctx.bezierCurveTo(kmToX(19.8), kmToY(13.7), kmToX(21.4), kmToY(13.5), kmToX(21.5), kmToY(13.5));
        // Borda direita da bigorna e descida até a superfície
        ctx.bezierCurveTo(kmToX(21.6), kmToY(9.5), kmToX(21.4), kmToY(4.0), kmToX(21.2), kmToY(0.0));
        // Solo de I até o pé da frente de rajada
        ctx.lineTo(kmToX(13.6), kmToY(0.0));
        // Borda inferior da cortina de precipitação e rampa da frente de rajada
        ctx.bezierCurveTo(kmToX(13.0), kmToY(2.2), kmToX(12.0), kmToY(3.5), kmToX(10.5), kmToY(3.6));
        ctx.lineTo(kmToX(10.5), kmToY(2.5));
        ctx.lineTo(kmToX(1.6), kmToY(2.5));
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // 3. NÚCLEOS DE REFLETIVIDADE (10, 30, 50 dBZ)
        // A. Contorno de 10 dBZ (Laranja): envolvente na Célula II e I
        ctx.fillStyle = 'rgba(249, 115, 22, 0.45)';
        ctx.strokeStyle = '#f97316';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(kmToX(9.2), kmToY(11.2));
        ctx.bezierCurveTo(kmToX(9.0), kmToY(12.8), kmToX(10.5), kmToY(13.2), kmToX(13.0), kmToY(13.1));
        ctx.bezierCurveTo(kmToX(16.0), kmToY(13.2), kmToX(19.5), kmToY(13.1), kmToX(21.5), kmToY(13.0));
        ctx.lineTo(kmToX(21.5), kmToY(4.5));
        ctx.bezierCurveTo(kmToX(21.3), kmToY(1.0), kmToX(19.5), kmToY(0.0), kmToX(13.8), kmToY(0.0));
        ctx.bezierCurveTo(kmToX(13.8), kmToY(4.5), kmToX(12.2), kmToY(8.0), kmToX(9.2), kmToY(11.2));
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Etiqueta '10' dBZ na bigorna
        ctx.fillStyle = '#ea580c';
        ctx.font = 'bold 12px JetBrains Mono, monospace';
        ctx.fillText('10', kmToX(20.4), kmToY(12.6));

        // B. Contorno de 30 dBZ (Magenta / Roxo): coluna de precipitação na Célula I
        ctx.fillStyle = 'rgba(217, 70, 239, 0.58)';
        ctx.strokeStyle = '#d946ef';
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.moveTo(kmToX(14.2), kmToY(0.0));
        ctx.lineTo(kmToX(14.4), kmToY(5.5));
        ctx.bezierCurveTo(kmToX(14.8), kmToY(9.8), kmToX(16.0), kmToY(11.0), kmToX(17.5), kmToY(11.0));
        ctx.bezierCurveTo(kmToX(19.0), kmToY(11.0), kmToX(19.8), kmToY(9.2), kmToX(19.8), kmToY(5.0));
        ctx.lineTo(kmToX(19.8), kmToY(0.0));
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Etiqueta '30' dBZ
        ctx.fillStyle = '#fdf4ff';
        ctx.font = 'bold 11px JetBrains Mono, monospace';
        ctx.fillText('30', kmToX(19.1), kmToY(6.5));
        ctx.fillText('30', kmToX(17.8), kmToY(3.5));

        // C. Contorno > 50 dBZ no Solo (Vermelho Intenso - Chuva Torrencial e Granizo)
        ctx.fillStyle = 'rgba(239, 68, 68, 0.72)';
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.moveTo(kmToX(15.0), kmToY(0.0));
        ctx.lineTo(kmToX(15.1), kmToY(3.8));
        ctx.bezierCurveTo(kmToX(15.3), kmToY(6.5), kmToX(16.2), kmToY(7.0), kmToX(17.0), kmToY(7.0));
        ctx.bezierCurveTo(kmToX(17.6), kmToY(7.0), kmToX(18.0), kmToY(5.8), kmToX(18.0), kmToY(3.5));
        ctx.lineTo(kmToX(18.0), kmToY(0.0));
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // D. Contorno 50 dBZ Suspenso no Topo da Célula II (Magenta / Roxo)
        ctx.fillStyle = 'rgba(217, 70, 239, 0.75)';
        ctx.strokeStyle = '#f472b6';
        ctx.lineWidth = 2.0;
        ctx.beginPath();
        ctx.ellipse(kmToX(11.0), kmToY(11.0), 1.2 * (width / 22), 1.5 * ((groundY - topY) / 16), 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Etiqueta '50' dBZ no topo de II
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 11px JetBrains Mono, monospace';
        ctx.fillText('50', kmToX(11.6), kmToY(11.0));

        // 4. FRENTE DE RAJADA (GUST FRONT) & PISCINA FRIA (COLD POOL)
        // Cunha de ar frio no solo entre Célula III e Célula II
        ctx.fillStyle = 'rgba(14, 165, 233, 0.15)';
        ctx.beginPath();
        ctx.moveTo(kmToX(10.2), kmToY(0.0));
        ctx.lineTo(kmToX(11.2), kmToY(3.6));
        ctx.lineTo(kmToX(13.6), kmToY(0.0));
        ctx.closePath();
        ctx.fill();

        // Linha inclinada da frente de rajada com dentes/triângulos meteorológicos pretos
        ctx.strokeStyle = '#020617';
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        ctx.moveTo(kmToX(10.2), kmToY(0.0));
        ctx.lineTo(kmToX(11.2), kmToY(3.6));
        ctx.stroke();

        // Triângulos pretos apontando para a esquerda (ar quente frontal)
        const drawColdFrontTriangle = (zMid: number) => {
          const fx = 10.2 + (zMid / 3.6) * 1.0;
          const pX = kmToX(fx);
          const pY = kmToY(zMid);
          ctx.fillStyle = '#020617';
          ctx.beginPath();
          ctx.moveTo(pX, pY - 7);
          ctx.lineTo(pX - 10, pY);
          ctx.lineTo(pX, pY + 7);
          ctx.closePath();
          ctx.fill();
        };
        drawColdFrontTriangle(1.0);
        drawColdFrontTriangle(2.4);

        // Turbulência de rajada na superfície (zig-zag do vento no solo)
        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(kmToX(8.8), kmToY(0.4));
        ctx.lineTo(kmToX(9.1), kmToY(0.8));
        ctx.lineTo(kmToX(9.4), kmToY(0.3));
        ctx.lineTo(kmToX(9.7), kmToY(0.9));
        ctx.lineTo(kmToX(10.0), kmToY(0.4));
        ctx.lineTo(kmToX(10.2), kmToY(0.0));
        ctx.stroke();

        // 5. RÓTULOS DAS 4 CÉLULAS (IV, III, II, I)
        ctx.fillStyle = '#f8fafc';
        ctx.font = 'bold 15px JetBrains Mono, monospace';
        ctx.fillText('IV', kmToX(3.4), kmToY(6.8));
        ctx.fillText('III', kmToX(7.1), kmToY(11.2));
        ctx.fillText('II', kmToX(11.4), kmToY(15.3));
        ctx.fillText('I', kmToX(17.2), kmToY(14.5));

        // 6. LINHAS DE FLUXO DE VENTO E SETAS (IDÊNTICAS AO DIAGRAMA DE REFERÊNCIA)
        ctx.lineWidth = 1.8;
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';

        // A. Influxo e subida suave na Célula IV
        ctx.beginPath();
        ctx.moveTo(kmToX(2.0), kmToY(0.4));
        ctx.bezierCurveTo(kmToX(2.6), kmToY(0.6), kmToX(3.2), kmToY(2.2), kmToX(3.5), kmToY(5.2));
        ctx.stroke();
        drawArrow(ctx, kmToX(3.48), kmToY(4.9), kmToX(3.5), kmToY(5.4), 7);

        // Flecha menor na base de IV
        drawArrow(ctx, kmToX(4.6), kmToY(2.2), kmToX(4.7), kmToY(3.6), 5);

        // B. Influxo e subida acelerada na Célula III
        ctx.beginPath();
        ctx.moveTo(kmToX(3.2), kmToY(0.4));
        ctx.bezierCurveTo(kmToX(5.2), kmToY(0.5), kmToX(6.8), kmToY(3.0), kmToX(7.2), kmToY(9.2));
        ctx.stroke();
        drawArrow(ctx, kmToX(7.18), kmToY(8.8), kmToX(7.2), kmToY(9.4), 8);

        // Flecha menor na base de III
        drawArrow(ctx, kmToX(8.8), kmToY(2.2), kmToX(8.9), kmToY(3.6), 5);

        // C. Influxo potente da camada limite que alimenta a Célula II
        ctx.beginPath();
        ctx.moveTo(kmToX(6.5), kmToY(0.4));
        ctx.bezierCurveTo(kmToX(8.8), kmToY(0.5), kmToX(10.2), kmToY(1.5), kmToX(11.0), kmToY(5.5));
        ctx.lineTo(kmToX(11.0), kmToY(12.5));
        ctx.stroke();

        // Trifurcação no topo da Célula II
        // Ramo central: sobe no topo penetrante
        drawArrow(ctx, kmToX(11.0), kmToY(12.5), kmToX(11.0), kmToY(14.6), 7);
        // Ramo esquerdo: diverge para a retaguarda
        drawArrow(ctx, kmToX(11.0), kmToY(12.5), kmToX(9.8), kmToY(13.6), 7);
        // Ramo direito: diverge para a bigorna
        drawArrow(ctx, kmToX(11.0), kmToY(12.5), kmToX(12.4), kmToY(13.6), 7);

        // D. Ramo ascendente inclinado sobre a rampa da frente de rajada
        ctx.beginPath();
        ctx.moveTo(kmToX(11.8), kmToY(3.8));
        ctx.bezierCurveTo(kmToX(12.8), kmToY(6.5), kmToX(14.5), kmToY(10.0), kmToX(15.5), kmToY(12.5));
        ctx.stroke();
        drawArrow(ctx, kmToX(15.5), kmToY(12.5), kmToX(14.0), kmToY(13.2), 6);
        drawArrow(ctx, kmToX(15.5), kmToY(12.5), kmToX(16.0), kmToY(13.8), 6);
        drawArrow(ctx, kmToX(15.5), kmToY(12.5), kmToX(17.5), kmToY(13.3), 6);

        // E. CORRENTE DESCENDENTE (DOWNDRAFT) NA CÉLULA I
        ctx.strokeStyle = '#020617';
        ctx.fillStyle = '#020617';
        ctx.lineWidth = 2.0;
        ctx.beginPath();
        ctx.moveTo(kmToX(16.8), kmToY(8.5));
        ctx.lineTo(kmToX(16.8), kmToY(1.5));
        ctx.stroke();
        drawArrow(ctx, kmToX(16.8), kmToY(2.2), kmToX(16.8), kmToY(1.0), 8);

        // Bifurcação na superfície (piscina fria e outflow)
        ctx.beginPath();
        ctx.moveTo(kmToX(16.8), kmToY(1.5));
        ctx.bezierCurveTo(kmToX(16.2), kmToY(0.6), kmToX(14.5), kmToY(0.4), kmToX(12.8), kmToY(0.4));
        ctx.stroke();
        drawArrow(ctx, kmToX(13.2), kmToY(0.4), kmToX(12.2), kmToY(0.4), 8);

        ctx.beginPath();
        ctx.moveTo(kmToX(16.8), kmToY(1.5));
        ctx.bezierCurveTo(kmToX(17.5), kmToY(0.6), kmToX(19.0), kmToY(0.4), kmToX(20.5), kmToY(0.4));
        ctx.stroke();
        drawArrow(ctx, kmToX(20.0), kmToY(0.4), kmToX(21.0), kmToY(0.4), 8);

        // Spotlight highlight if selected
        if (multicellHighlight !== 'all') {
          ctx.save();
          ctx.strokeStyle = '#f59e0b';
          ctx.lineWidth = 2.0;
          ctx.setLineDash([6, 4]);
          let hX = 0, hW = 0, hZTop = 0;
          if (multicellHighlight === 'IV') { hX = 1.6; hW = 3.6; hZTop = 6.6; }
          else if (multicellHighlight === 'III') { hX = 5.2; hW = 4.0; hZTop = 11.0; }
          else if (multicellHighlight === 'II') { hX = 9.2; hW = 4.4; hZTop = 15.6; }
          else if (multicellHighlight === 'I') { hX = 13.6; hW = 8.0; hZTop = 14.2; }
          else if (multicellHighlight === 'gust_front') { hX = 8.8; hW = 5.0; hZTop = 4.2; }
          ctx.strokeRect(kmToX(hX), kmToY(hZTop), (hW / 22.0) * width, (hZTop / 16.0) * (groundY - topY));
          ctx.restore();
        }

        // Título e Descritivo Científico (posicionado no céu aberto acima de IV e III)
        ctx.fillStyle = '#f8fafc';
        ctx.font = 'bold 11px JetBrains Mono, monospace';
        ctx.fillText('Tempestade Muito Forte (Linha de Flanco: IV → III → II → I)', kmToX(1.4), kmToY(13.8));
        ctx.fillStyle = 'rgba(148, 163, 184, 0.85)';
        ctx.font = '9px JetBrains Mono, monospace';
        ctx.fillText('Elo Intermediário: Frente de Rajada regenera continuamente novas células', kmToX(1.4), kmToY(13.2));

      } else {
        // Supercélula com bigorna gigante, overshooting top e corte inclinado
        const tiltX = (engine.params.updraftTiltDeg / 25.0) * 4.0;
        const xBase = 8.5;

        ctx.beginPath();
        ctx.moveTo(kmToX(xBase - 3.2), kmToY(1.2));
        ctx.bezierCurveTo(
          kmToX(xBase - 4.5), kmToY(4.5),
          kmToX(xBase - 5.0 + tiltX * 0.4), kmToY(8.5),
          kmToX(xBase - 6.2 + tiltX), kmToY(12.2)
        );
        // Overshooting dome
        ctx.bezierCurveTo(
          kmToX(xBase - 3.0 + tiltX), kmToY(13.5),
          kmToX(xBase + 4.0 + tiltX), kmToY(13.3),
          kmToX(xBase + 10.8 + tiltX), kmToY(11.4)
        );
        // Forward flank
        ctx.bezierCurveTo(
          kmToX(xBase + 8.5 + tiltX * 0.6), kmToY(7.5),
          kmToX(xBase + 7.5), kmToY(3.5),
          kmToX(xBase + 6.5), kmToY(1.2)
        );
        ctx.closePath();

        const superGrad = ctx.createLinearGradient(0, kmToY(13.0), 0, kmToY(1.0));
        superGrad.addColorStop(0, 'rgba(30, 41, 59, 0.88)');
        superGrad.addColorStop(0.5, 'rgba(15, 23, 42, 0.95)');
        superGrad.addColorStop(1, 'rgba(30, 41, 59, 0.90)');
        ctx.fillStyle = superGrad;
        ctx.fill();
        ctx.strokeStyle = 'rgba(71, 85, 105, 0.55)';
        ctx.stroke();

        ctx.fillStyle = '#f59e0b';
        ctx.font = 'bold 11px JetBrains Mono, monospace';
        ctx.fillText('Supercélula Severa (Cumulonimbus Inclinado com Bigorna)', kmToX(3.5), kmToY(13.6));
      }

      ctx.restore();

      // 5. CONVECTIVE UP/DOWNDRAFT CURRENTS (ONLY DRAWN IN CONVECTIVE FAMILY!)
      if (isConvective && scenario !== 'tempestade_comum' && scenario !== 'tempestade_forte' && useSimulationStore.getState().showWindField) {
        // Updraft Column
        const xUpBase = engine.wind.getUpdraftX(1.5, engine.params.updraftTiltDeg);
        const xUpTop = engine.wind.getUpdraftX(11.5, engine.params.updraftTiltDeg);

        ctx.save();
        for (let col = -1; col <= 1; col++) {
          const offsetKm = col * 1.0;
          ctx.strokeStyle = col === 0 ? 'rgba(234, 179, 8, 0.7)' : 'rgba(56, 189, 248, 0.45)';
          ctx.lineWidth = col === 0 ? 2.0 : 1.2;
          ctx.beginPath();
          ctx.moveTo(kmToX(xUpBase + offsetKm), kmToY(1.5));
          for (let z = 2.0; z <= 11.5; z += 1.0) {
            const curX = engine.wind.getUpdraftX(z, engine.params.updraftTiltDeg) + offsetKm;
            ctx.lineTo(kmToX(curX), kmToY(z));
          }
          ctx.stroke();

          const phase = (animClock * 2.2 + col * 0.3) % 1.0;
          const arrowZ = 1.5 + phase * 9.5;
          const arrowX = engine.wind.getUpdraftX(arrowZ, engine.params.updraftTiltDeg) + offsetKm;
          ctx.fillStyle = '#f59e0b';
          ctx.beginPath();
          ctx.arc(kmToX(arrowX), kmToY(arrowZ), 3.0, 0, Math.PI * 2);
          ctx.fill();
        }

        const upBadgeX = kmToX(xUpTop - 1.8);
        const upBadgeY = kmToY(11.4);
        ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
        ctx.fillRect(upBadgeX - 4, upBadgeY - 12, 190, 18);
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 1;
        ctx.strokeRect(upBadgeX - 4, upBadgeY - 12, 190, 18);
        ctx.fillStyle = '#fbbf24';
        ctx.font = 'bold 10px JetBrains Mono, monospace';
        ctx.fillText('▲ CORRENTE ASCENDENTE (Updraft)', upBadgeX, upBadgeY);
        ctx.restore();

        // Downdraft Column
        const xDownBase = engine.wind.getDowndraftX(0.5);
        const xDownTop = engine.wind.getDowndraftX(9.5);

        ctx.save();
        for (let col = -1; col <= 1; col++) {
          const offsetKm = col * 0.9;
          ctx.strokeStyle = 'rgba(129, 140, 248, 0.7)';
          ctx.lineWidth = col === 0 ? 2.0 : 1.2;
          ctx.beginPath();
          ctx.moveTo(kmToX(xDownTop + offsetKm), kmToY(9.5));
          for (let z = 9.0; z >= 0.5; z -= 1.0) {
            const curX = engine.wind.getDowndraftX(z) + offsetKm;
            ctx.lineTo(kmToX(curX), kmToY(z));
          }
          ctx.stroke();

          const phase = (animClock * 2.5 + col * 0.35) % 1.0;
          const arrowZ = 9.5 - phase * 9.0;
          const arrowX = engine.wind.getDowndraftX(arrowZ) + offsetKm;
          ctx.fillStyle = '#818cf8';
          ctx.beginPath();
          ctx.arc(kmToX(arrowX), kmToY(arrowZ), 3.0, 0, Math.PI * 2);
          ctx.fill();
        }

        const downBadgeX = kmToX(xDownTop - 1.8);
        const downBadgeY = kmToY(9.2);
        ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
        ctx.fillRect(downBadgeX - 4, downBadgeY - 12, 195, 18);
        ctx.strokeStyle = '#818cf8';
        ctx.lineWidth = 1;
        ctx.strokeRect(downBadgeX - 4, downBadgeY - 12, 195, 18);
        ctx.fillStyle = '#a5b4fc';
        ctx.font = 'bold 10px JetBrains Mono, monospace';
        ctx.fillText('▼ CORRENTE DESCENDENTE (Downdraft)', downBadgeX, downBadgeY);
        ctx.restore();
      }

      // 6. Trajectories
      if (useSimulationStore.getState().showTrajectories) {
        for (let i = 0; i < engine.particles.activeCount; i++) {
          if (engine.particles.alive[i] === 0) continue;
          const traj = engine.particles.trajectories[i];
          if (!traj || traj.length < 2) continue;

          const isSelected = i === selectedParticleId - 1;
          ctx.strokeStyle = isSelected ? 'rgba(251, 191, 36, 0.95)' : 'rgba(148, 163, 184, 0.2)';
          ctx.lineWidth = isSelected ? 2.2 : 0.8;

          ctx.beginPath();
          ctx.moveTo(kmToX(traj[0].x), kmToY(traj[0].z));
          for (let k = 1; k < traj.length; k++) {
            ctx.lineTo(kmToX(traj[k].x), kmToY(traj[k].z));
          }
          ctx.stroke();
        }
      }

      // 7. RENDER PARTICLES ACCORDING TO PHYSICAL PHASE
      const count = engine.particles.activeCount;
      for (let i = 0; i < count; i++) {
        if (engine.particles.alive[i] === 0) continue;

        const px = kmToX(engine.particles.positionsX[i]);
        const py = kmToY(engine.particles.positionsZ[i]);
        const diam = engine.particles.diameters[i];
        const type = engine.particles.types[i] as ParticleType;
        const regime = engine.particles.regimes[i] as GrowthRegime;
        const loops = engine.particles.recirculations[i];
        const isSelected = i === selectedParticleId - 1;

        ctx.save();

        if (type === ParticleType.SNOW) {
          // White dendritic snowflake
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1.2;
          const r = Math.max(2.5, diam * 0.9);
          ctx.beginPath();
          // 6 branches of snowflake
          for (let a = 0; a < 3; a++) {
            const angle = (a * Math.PI) / 3;
            ctx.moveTo(px - r * Math.cos(angle), py - r * Math.sin(angle));
            ctx.lineTo(px + r * Math.cos(angle), py + r * Math.sin(angle));
          }
          ctx.stroke();
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(px, py, 1.2, 0, Math.PI * 2);
          ctx.fill();

        } else if (type === ParticleType.MELTING_SNOW) {
          // Slushy melting snowflake with liquid water film
          ctx.fillStyle = 'rgba(186, 230, 253, 0.7)';
          ctx.beginPath();
          ctx.arc(px, py, 3.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1.0;
          ctx.stroke();

        } else if (type === ParticleType.RAIN) {
          // Liquid raindrop
          ctx.fillStyle = '#38bdf8';
          ctx.beginPath();
          ctx.arc(px, py, Math.max(2.0, diam * 0.75), 0, Math.PI * 2);
          ctx.fill();

        } else if (type === ParticleType.SUPERCOOLED_DROP) {
          // Supercooled liquid droplet (Freezing rain) - glowing liquid cyan with blue rim
          ctx.fillStyle = '#22d3ee';
          ctx.beginPath();
          ctx.arc(px, py, 3.0, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#0284c7';
          ctx.lineWidth = 1.2;
          ctx.stroke();

        } else if (type === ParticleType.SLEET) {
          // Sleet: Solid translucent ice pellet
          const sleetGrad = ctx.createRadialGradient(px - 1, py - 1, 0.5, px, py, 3.8);
          sleetGrad.addColorStop(0, '#ffffff');
          sleetGrad.addColorStop(0.6, '#a5b4fc');
          sleetGrad.addColorStop(1, '#4f46e5');
          ctx.fillStyle = sleetGrad;
          ctx.beginPath();
          ctx.arc(px, py, 3.8, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1.0;
          ctx.stroke();

        } else if (type === ParticleType.GRAUPEL) {
          // Porous rime snow pellet
          ctx.fillStyle = '#f8fafc';
          ctx.beginPath();
          ctx.arc(px, py, Math.max(2.8, diam * 0.8), 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#94a3b8';
          ctx.lineWidth = 1.0;
          ctx.stroke();

        } else {
          // Hailstone with concentric onion skin rings
          const r = Math.max(3.5, Math.min(24, (diam / 2.0) * 0.85));
          if (regime === GrowthRegime.DRY) {
            ctx.fillStyle = '#f1f5f9';
            ctx.beginPath();
            ctx.arc(px, py, r, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#cbd5e1';
            ctx.lineWidth = 1.5;
            ctx.stroke();
          } else {
            const glazeGrad = ctx.createRadialGradient(px - r * 0.3, py - r * 0.3, r * 0.1, px, py, r);
            glazeGrad.addColorStop(0, '#ffffff');
            glazeGrad.addColorStop(0.5, '#7dd3fc');
            glazeGrad.addColorStop(1, '#0284c7');
            ctx.fillStyle = glazeGrad;
            ctx.beginPath();
            ctx.arc(px, py, r, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#38bdf8';
            ctx.lineWidth = 1.5;
            ctx.stroke();
          }

          if (loops > 0 && r > 5) {
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 1.0;
            ctx.beginPath();
            ctx.arc(px, py, r * 0.55, 0, Math.PI * 2);
            ctx.stroke();
          }
        }

        // Highlight selected particle
        if (isSelected) {
          ctx.strokeStyle = '#f59e0b';
          ctx.lineWidth = 2.0;
          ctx.beginPath();
          ctx.arc(px, py, Math.max(4.0, diam * 0.85) + 5.0, 0, Math.PI * 2);
          ctx.stroke();

          ctx.fillStyle = '#f59e0b';
          ctx.font = 'bold 10px JetBrains Mono, monospace';
          const typeName =
            type === ParticleType.SNOW ? 'Neve' :
            type === ParticleType.MELTING_SNOW ? 'Neve em fusão' :
            type === ParticleType.RAIN ? 'Chuva' :
            type === ParticleType.SLEET ? 'Pelota de gelo (sleet)' :
            type === ParticleType.SUPERCOOLED_DROP ? 'Chuva congelante' :
            type === ParticleType.GRAUPEL ? 'Graupel' : 'Granizo';
          ctx.fillText(`P${i + 1} (${typeName} • ${diam.toFixed(1)}mm)`, px + 12, py + 3);
        }

        ctx.restore();
      }

      // 8. Ground Surface Line & Freezing Rain Glaze Coating
      ctx.fillStyle = '#090d16';
      ctx.fillRect(0, groundY, width, height - groundY);
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 2.0;
      ctx.beginPath();
      ctx.moveTo(0, groundY);
      ctx.lineTo(width, groundY);
      ctx.stroke();

      // If Freezing Rain is occurring, draw glowing icy glaze layer over the ground!
      const glazeMm = engine.groundStats.glazeIceThicknessMm;
      if (glazeMm > 0.1) {
        ctx.fillStyle = 'rgba(56, 189, 248, 0.4)';
        const glazePx = Math.min(12, glazeMm * 0.8);
        ctx.fillRect(0, groundY - glazePx, width, glazePx);
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(0, groundY - glazePx);
        ctx.lineTo(width, groundY - glazePx);
        ctx.stroke();

        ctx.fillStyle = '#67e8f9';
        ctx.font = 'bold 9px JetBrains Mono, monospace';
        ctx.fillText(`❄️ Película de Gelo no Solo (Glaze): ${glazeMm.toFixed(1)} mm`, width - 260, groundY - glazePx - 3);
      }

      // Ground Labels
      ctx.fillStyle = '#94a3b8';
      ctx.font = '10px JetBrains Mono, monospace';
      ctx.fillText('0 km (Superfície)', 10, groundY + 16);

      animFrameId = requestAnimationFrame(render);
    };

    animFrameId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animFrameId);
    };
  }, [params, activeScenario, selectedParticleId, selectParticle, updateTelemetry, updateGroundStats]);

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const clickX = ((e.clientX - rect.left) / rect.width) * canvas.width;
    const clickY = ((e.clientY - rect.top) / rect.height) * canvas.height;

    const width = canvas.width;
    const height = canvas.height;
    const groundY = height - 44;
    const topY = 28;

    const clickXKm = (clickX / width) * 22.0;
    const clickZKm = Math.max(0, ((groundY - clickY) / (groundY - topY)) * 16.0);

    const engine = engineRef.current;
    if (!engine) return;

    let closestId = 1;
    let minDistanceSq = 12.0;

    for (let i = 0; i < engine.particles.activeCount; i++) {
      if (engine.particles.alive[i] === 0) continue;
      const dx = engine.particles.positionsX[i] - clickXKm;
      const dz = engine.particles.positionsZ[i] - clickZKm;
      const distSq = dx * dx + dz * dz;
      if (distSq < minDistanceSq) {
        minDistanceSq = distSq;
        closestId = i + 1;
      }
    }
    selectParticle(closestId);
  };

  return (
    <div ref={containerRef} className="relative w-full rounded-2xl overflow-hidden border border-slate-800 bg-slate-950 shadow-2xl">
      <canvas
        ref={canvasRef}
        width={960}
        height={560}
        onClick={handleCanvasClick}
        className="w-full h-auto block cursor-crosshair"
      />
      {/* Ordinary Storm Byers & Braham (1949) Interactive Lifecycle Bar */}
      {activeScenario === 'tempestade_comum' && (
        <div className="bg-slate-900/95 border-t border-slate-800 p-2.5 sm:p-3 text-xs space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            {/* Play/Pause & Time */}
            <div className="flex items-center gap-2">
              <button
                onClick={toggleAutoEvolveStorm}
                className={`px-3 py-1 rounded-lg font-bold flex items-center gap-1.5 text-xs transition shadow ${
                  params.autoEvolveStorm ? 'bg-amber-600 hover:bg-amber-500 text-white' : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                }`}
              >
                {params.autoEvolveStorm ? '⏸️ Pausar Ciclo' : '▶️ Ciclo Acelerado'}
              </button>

              <span className="font-mono font-bold text-cyan-400 text-xs sm:text-sm bg-slate-950 px-2.5 py-0.5 rounded border border-cyan-800/60">
                ⏱️ {(params.stormMinutes ?? 0).toFixed(1)} / 30.0 min
              </span>

              {/* Speed buttons */}
              <div className="flex items-center gap-1 bg-slate-950 p-0.5 rounded-lg border border-slate-800 text-[11px]">
                <span className="text-[10px] text-slate-500 px-1 font-bold">Velocidade:</span>
                {[
                  { label: '1x (25s)', rate: 1.2 },
                  { label: '2x (12s)', rate: 2.4 },
                  { label: '4x (6s)', rate: 4.8 }
                ].map((s) => (
                  <button
                    key={s.label}
                    onClick={() => setStormEvolutionRate(s.rate)}
                    className={`px-2 py-0.5 rounded font-bold transition ${
                      Math.abs((params.stormEvolutionRate ?? 1.2) - s.rate) < 0.1
                        ? 'bg-cyan-600 text-white shadow'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Reference Diagram Toggle */}
            <button
              onClick={() => setShowDiagramModal(!showDiagramModal)}
              className="px-2.5 py-1 rounded-lg bg-cyan-950 border border-cyan-800 text-cyan-300 hover:bg-cyan-900 font-bold text-xs flex items-center gap-1 transition shadow"
            >
              📖 {showDiagramModal ? 'Ocultar Diagrama Byers & Braham' : 'Ver Diagrama de Referencia (1949)'}
            </button>
          </div>

          {/* Scrubber slider */}
          <div className="flex items-center gap-3 pt-1">
            <span className="text-slate-400 text-[11px] font-mono whitespace-nowrap">0 min</span>
            <input
              type="range"
              min="0"
              max="30"
              step="0.2"
              value={params.stormMinutes ?? 0}
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                setStormMinutes(val);
                if (engineRef.current) engineRef.current.params.stormMinutes = val;
              }}
              className="flex-1 h-2 bg-slate-800 rounded-lg cursor-pointer accent-cyan-400"
            />
            <span className="text-slate-400 text-[11px] font-mono whitespace-nowrap">30 min</span>
          </div>

          {/* Quick jump stage buttons */}
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-1 pt-1">
            {[
              { min: 0, label: '0m: Cumulus' },
              { min: 10, label: '10m: Congestus' },
              { min: 15, label: '15m: Torre Alta' },
              { min: 20, label: '20m: Maduro (Auge)' },
              { min: 25, label: '25m: Downdraft' },
              { min: 30, label: '30m: Dissipacao' }
            ].map((st) => (
              <button
                key={st.min}
                onClick={() => {
                  setStormMinutes(st.min);
                  if (engineRef.current) engineRef.current.params.stormMinutes = st.min;
                }}
                className={`px-1.5 py-1 rounded text-[10px] font-semibold border transition text-center ${
                  Math.abs((params.stormMinutes ?? 0) - st.min) < 2.5
                    ? 'bg-cyan-950 border-cyan-400 text-cyan-300 font-bold shadow'
                    : 'bg-slate-800/80 border-slate-700 text-slate-400 hover:text-white'
                }`}
              >
                {st.label}
              </button>
            ))}
          </div>

          {/* Modal / Card showing Byers & Braham (1949) Diagram */}
          {showDiagramModal && (
            <div className="p-3 bg-slate-950 border border-cyan-800/60 rounded-xl space-y-2 mt-2">
              <div className="flex justify-between items-center border-b border-slate-800 pb-1.5">
                <h5 className="font-bold text-cyan-300 text-xs flex items-center gap-1.5">
                  <span>📊</span> Diagrama Classico: Byers & Braham (1949) - The Thunderstorm Project
                </h5>
                <button
                  onClick={() => setShowDiagramModal(false)}
                  className="text-slate-400 hover:text-white text-xs px-2 py-0.5 rounded bg-slate-800"
                >
                  ✕ Fechar
                </button>
              </div>
              <img
                src="./assets/byers_braham_1949_storm.png"
                alt="Diagrama de Tempestade Comum - Byers e Braham (1949)"
                className="w-full max-h-72 object-contain rounded-lg bg-white p-2"
              />
              <p className="text-[11px] text-slate-300 leading-relaxed">
                Observe as fases: <strong>0 a 15 min</strong> (crescimento de 4 a 9 km, correntes ascendentes puras, nucleos 1 e 3); 
                <strong> 20 min</strong> (estagio maduro com bigorna em 11 km, nucleo maximo 5 e surgimento do downdraft com chuva); 
                <strong> 25 a 30 min</strong> (dissipacao com downdraft dominante sufocando a tempestade).
              </p>
            </div>
          )}
        </div>
      )}

      {/* Multicell Severe Storm Interactive Explanatory Bar */}
      {activeScenario === 'tempestade_forte' && (
        <div className="bg-slate-900/95 border-t border-slate-800 p-2.5 sm:p-3 text-xs space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 rounded-lg bg-amber-950 border border-amber-800 text-amber-300 font-bold text-xs flex items-center gap-1">
                ⚡ Tempestade Muito Forte (Multicelular)
              </span>
              <span className="text-[11px] text-slate-300 hidden md:inline">
                Meio-termo entre tempestade comum e multicélula persistente
              </span>
            </div>

            {/* Reference Diagram Toggle */}
            <button
              onClick={() => setShowMulticellModal(!showMulticellModal)}
              className="px-2.5 py-1 rounded-lg bg-amber-950 border border-amber-800 text-amber-300 hover:bg-amber-900 font-bold text-xs flex items-center gap-1 transition shadow"
            >
              📖 {showMulticellModal ? 'Ocultar Diagrama de Referência' : 'Ver Diagrama da Tempestade Muito Forte'}
            </button>
          </div>

          {/* Quick jump to examine cell stages */}
          <div className="grid grid-cols-2 sm:grid-cols-6 gap-1 pt-1">
            {[
              { key: 'all', label: 'Todas as Células' },
              { key: 'IV', label: 'Célula IV: Flanco (6 km)' },
              { key: 'III', label: 'Célula III: Congestus (10 km)' },
              { key: 'II', label: 'Célula II: Ápice (15 km)' },
              { key: 'I', label: 'Célula I: Chuva & Downdraft' },
              { key: 'gust_front', label: 'Frente de Rajada (Solo)' }
            ].map((c) => (
              <button
                key={c.key}
                onClick={() => setMulticellHighlight(c.key as any)}
                className={`px-2 py-1 rounded text-[10px] font-semibold border transition text-center ${
                  multicellHighlight === c.key
                    ? 'bg-amber-950 border-amber-400 text-amber-300 font-bold shadow'
                    : 'bg-slate-800/80 border-slate-700 text-slate-400 hover:text-white'
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>

          {/* Modal / Card showing Multicell Storm Diagram */}
          {showMulticellModal && (
            <div className="p-3 bg-slate-950 border border-amber-800/60 rounded-xl space-y-2 mt-2">
              <div className="flex justify-between items-center border-b border-slate-800 pb-1.5">
                <h5 className="font-bold text-amber-300 text-xs flex items-center gap-1.5">
                  <span>📊</span> Diagrama de Referência: Tempestade Muito Forte / Multicelular com Linha de Flanco
                </h5>
                <button
                  onClick={() => setShowMulticellModal(false)}
                  className="text-slate-400 hover:text-white text-xs px-2 py-0.5 rounded bg-slate-800"
                >
                  ✕ Fechar
                </button>
              </div>
              <img
                src="./assets/multicell_storm_diagram.png"
                alt="Diagrama da Tempestade Muito Forte - Multicelular"
                className="w-full max-h-80 object-contain rounded-lg bg-white p-2"
              />
              <div className="text-[11px] text-slate-300 space-y-1.5 leading-relaxed bg-slate-900/80 p-2.5 rounded-lg border border-slate-800">
                <p>
                  <strong>Por que é um meio-termo entre tempestade comum e multicélula?</strong> Na tempestade comum de Byers & Braham (1949), a corrente descendente cai sobre a ascendente e a asfixia em 30 minutos. Na tempestade muito forte, a <strong>separação espacial</strong> entre a subida (Célula II) e a descida (Célula I) permite regeneração sucessiva.
                </p>
                <p>
                  <strong>O papel da Frente de Rajada (Gust Front):</strong> O ar frio gerado pela evaporação da precipitação na Célula I atinge o solo e se espalha para a esquerda como uma cunha densa (marcada com triângulos pretos). Essa cunha força o ar quente da superfície a subir explosivamente, gerando a Célula II e alimentando novas células na linha de flanco (IV e III).
                </p>
                <p>
                  <strong>Núcleos de Refletividade:</strong> O contorno de <strong>10 dBZ (laranja)</strong> abrange a bigorna e a borda da tempestade; <strong>30 dBZ (magenta)</strong> marca a coluna principal de chuva; e <strong>50 dBZ (vermelho no solo e magenta no topo da Célula II)</strong> marca onde o granizo cresce sustentado pelo updraft e despenca em direção à superfície.
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="absolute top-2 left-3 pointer-events-none flex items-center gap-2">
        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-900/90 text-cyan-400 border border-slate-700/60 backdrop-blur-sm">
          {params.family === 'thermodynamic' ? 'Precipitação Termodinâmica (NOAA NESDIS)' : 'Precipitação Convectiva (Tempestades Severas)'}
        </span>
        <span className="text-[10px] text-slate-400 font-mono hidden sm:inline">
          Clique em qualquer partícula para ver sua telemetria
        </span>
      </div>
    </div>
  );
};
