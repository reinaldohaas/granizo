import React, { useEffect, useRef, useCallback } from 'react';
import { useSimulationStore } from '../store/simulationStore';
import { SimulationEngine } from '../simulation/SimulationEngine';
import { ParticleType, GrowthRegime, ScenarioPreset } from '../types/simulationTypes';

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
      const kmToX = (xKm: number) => (xKm / 22.0) * width;
      const kmToY = (zKm: number) => groundY - (zKm / 14.0) * (groundY - topY);

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
        ctx.fillText(`0°C (${engine.params.zFreezingKm.toFixed(1)} km) - Nível de Fusão/Congelamento`, 8, fzY - 4);
        ctx.setLineDash([]);
      }

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
        // Cumulus congestus evoluindo para Cumulonimbus
        ctx.fillStyle = 'rgba(30, 41, 59, 0.85)';
        ctx.beginPath();
        ctx.moveTo(kmToX(5.5), kmToY(1.8));
        // Upright cauliflower bulges
        ctx.bezierCurveTo(kmToX(4.5), kmToY(4.5), kmToX(5.0), kmToY(7.0), kmToX(6.5), kmToY(9.2));
        ctx.bezierCurveTo(kmToX(7.5), kmToY(10.2), kmToX(9.5), kmToY(10.2), kmToX(11.0), kmToY(9.4));
        ctx.bezierCurveTo(kmToX(12.5), kmToY(7.5), kmToX(12.5), kmToY(4.5), kmToX(11.8), kmToY(1.8));
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = 'rgba(71, 85, 105, 0.5)';
        ctx.stroke();

        ctx.fillStyle = '#cbd5e1';
        ctx.font = 'bold 11px JetBrains Mono, monospace';
        ctx.fillText('Cumulus Congestus / Cb Jovem (Tempestade Comum)', kmToX(5.8), kmToY(10.5));

      } else if (scenario === 'tempestade_forte') {
        // Cumulonimbus grande com várias torres
        ctx.fillStyle = 'rgba(30, 41, 59, 0.88)';
        ctx.beginPath();
        ctx.moveTo(kmToX(3.5), kmToY(1.6));
        // Secondary turret left
        ctx.bezierCurveTo(kmToX(3.0), kmToY(5.0), kmToX(4.5), kmToY(8.0), kmToX(6.0), kmToY(8.8));
        // Main tower center
        ctx.bezierCurveTo(kmToX(7.0), kmToY(11.2), kmToX(9.5), kmToY(11.5), kmToX(11.5), kmToY(10.5));
        // Developing turret right
        ctx.bezierCurveTo(kmToX(13.0), kmToY(8.5), kmToX(14.5), kmToY(5.5), kmToX(14.0), kmToY(1.6));
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = 'rgba(71, 85, 105, 0.55)';
        ctx.stroke();

        ctx.fillStyle = '#cbd5e1';
        ctx.font = 'bold 11px JetBrains Mono, monospace';
        ctx.fillText('Cumulonimbus Multicelular (Tempestade Forte)', kmToX(5.0), kmToY(11.8));

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
      if (isConvective && useSimulationStore.getState().showWindField) {
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
    const clickZKm = Math.max(0, ((groundY - clickY) / (groundY - topY)) * 14.0);

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
