import React, { useEffect, useRef } from 'react';
import { useSimulationStore } from '../store/simulationStore';
import { SimulationEngine } from '../simulation/SimulationEngine';
import { ParticleType, GrowthRegime } from '../types/simulationTypes';

export const SimulationCanvas: React.FC = () => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<SimulationEngine | null>(null);

  const params = useSimulationStore((state) => state.params);
  const selectedParticleId = useSimulationStore((state) => state.selectedParticleId);

  const selectParticle = useSimulationStore((state) => state.selectParticle);
  const updateTelemetry = useSimulationStore((state) => state.updateTelemetry);
  const updateGroundStats = useSimulationStore((state) => state.updateGroundStats);

  if (!engineRef.current) {
    engineRef.current = new SimulationEngine(params);
  }

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

      if (now - lastReactSync > 100) {
        lastReactSync = now;
        const selIdx = useSimulationStore.getState().selectedParticleId - 1;
        if (selIdx >= 0 && selIdx < engine.particles.activeCount) {
          const z = engine.particles.positionsZ[selIdx];
          const T = engine.atmos.getTemperature(z, engine.params.zFreezingKm, engine.params.soundingNodes);
          const { w } = engine.wind.evaluate(engine.particles.positionsX[selIdx], z, engine.simTimeSec, engine.params);
          const rhoAir = engine.atmos.getAirDensity(z);
          const diam = engine.particles.diameters[selIdx];
          const vt = 9.0 * Math.sqrt(Math.max(0.1, diam / 10.0)) * Math.sqrt(1.225 / rhoAir);
          updateTelemetry(engine.particles.getTelemetry(selIdx, T, w, vt));
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

      // 2. Warm Lower Layer (T > 0°C)
      const fzY = kmToY(engine.params.zFreezingKm);
      ctx.fillStyle = 'rgba(239, 68, 68, 0.04)';
      ctx.fillRect(0, fzY, width, groundY - fzY);

      // 3. Hail Growth Zone (-10°C to -30°C)
      const iso = engine.atmos.getIsothermAltitudes(engine.params.zFreezingKm);
      const yM10 = kmToY(iso.zMinus10C);
      const yM30 = kmToY(iso.zMinus30C);
      ctx.fillStyle = 'rgba(14, 165, 233, 0.06)';
      ctx.fillRect(kmToX(1.0), yM30, kmToX(20.0), yM10 - yM30);

      // 4. Cloud Silhouette (Deep Convection)
      const tiltX = (engine.params.updraftTiltDeg / 25.0) * 4.0;
      const xBase = 8.5;

      ctx.save();
      ctx.beginPath();
      ctx.moveTo(kmToX(xBase - 3.2), kmToY(1.2));
      // Left updraft flank
      ctx.bezierCurveTo(
        kmToX(xBase - 4.5), kmToY(4.5),
        kmToX(xBase - 5.0 + tiltX * 0.4), kmToY(8.5),
        kmToX(xBase - 6.2 + tiltX), kmToY(12.2)
      );
      // Anvil dome
      ctx.bezierCurveTo(
        kmToX(xBase - 3.0 + tiltX), kmToY(13.4),
        kmToX(xBase + 4.0 + tiltX), kmToY(13.2),
        kmToX(xBase + 10.5 + tiltX), kmToY(11.4)
      );
      // Right downdraft flank
      ctx.bezierCurveTo(
        kmToX(xBase + 8.5 + tiltX * 0.6), kmToY(7.5),
        kmToX(xBase + 7.5), kmToY(3.5),
        kmToX(xBase + 6.5), kmToY(1.2)
      );
      ctx.closePath();

      const cloudGrad = ctx.createLinearGradient(0, kmToY(13.0), 0, kmToY(1.0));
      cloudGrad.addColorStop(0, 'rgba(30, 41, 59, 0.85)');
      cloudGrad.addColorStop(0.5, 'rgba(15, 23, 42, 0.92)');
      cloudGrad.addColorStop(1, 'rgba(30, 41, 59, 0.88)');
      ctx.fillStyle = cloudGrad;
      ctx.fill();
      ctx.strokeStyle = 'rgba(71, 85, 105, 0.45)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.restore();

      // 5. DRAW CORRENTE ASCENDENTE (Updraft Column with Golden/Cyan Glow)
      const xUpBase = engine.wind.getUpdraftX(1.5, engine.params.updraftTiltDeg);
      const xUpTop = engine.wind.getUpdraftX(11.5, engine.params.updraftTiltDeg);

      ctx.save();
      ctx.beginPath();
      ctx.moveTo(kmToX(xUpBase - 1.8), kmToY(1.2));
      ctx.lineTo(kmToX(xUpTop - 2.2), kmToY(11.5));
      ctx.lineTo(kmToX(xUpTop + 2.2), kmToY(11.5));
      ctx.lineTo(kmToX(xUpBase + 1.8), kmToY(1.2));
      ctx.closePath();
      const updraftGrad = ctx.createLinearGradient(kmToX(xUpBase), kmToY(1.2), kmToX(xUpTop), kmToY(11.5));
      updraftGrad.addColorStop(0, 'rgba(234, 179, 8, 0.08)');
      updraftGrad.addColorStop(0.5, 'rgba(6, 182, 212, 0.12)');
      updraftGrad.addColorStop(1, 'rgba(56, 189, 248, 0.05)');
      ctx.fillStyle = updraftGrad;
      ctx.fill();

      // Updraft animated upward streamlines & arrows
      if (useSimulationStore.getState().showWindField) {
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

          // Animated arrows going UP
          const phase = (animClock * 2.2 + col * 0.3) % 1.0;
          const arrowZ = 1.5 + phase * 9.5;
          const arrowX = engine.wind.getUpdraftX(arrowZ, engine.params.updraftTiltDeg) + offsetKm;
          ctx.fillStyle = '#f59e0b';
          ctx.beginPath();
          ctx.arc(kmToX(arrowX), kmToY(arrowZ), 3.0, 0, Math.PI * 2);
          ctx.fill();
        }

        // Updraft Banner Badge
        ctx.fillStyle = 'rgba(245, 158, 11, 0.95)';
        ctx.font = 'bold 11px JetBrains Mono, monospace';
        ctx.fillText('▲ CORRENTE ASCENDENTE (+w: Sobe e Cresce)', kmToX(xUpBase - 1.5), kmToY(4.5));
      }
      ctx.restore();

      // 6. DRAW CORRENTE DESCENDENTE (Downdraft Shaft in Blue/Indigo)
      const xDownBase = engine.wind.getDowndraftX(0.5);
      const xDownTop = engine.wind.getDowndraftX(9.5);

      ctx.save();
      ctx.beginPath();
      ctx.moveTo(kmToX(xDownTop - 2.2), kmToY(9.5));
      ctx.lineTo(kmToX(xDownBase - 2.0), groundY);
      ctx.lineTo(kmToX(xDownBase + 2.0), groundY);
      ctx.lineTo(kmToX(xDownTop + 2.2), kmToY(9.5));
      ctx.closePath();

      const downGrad = ctx.createLinearGradient(kmToX(xDownTop), kmToY(9.5), kmToX(xDownBase), groundY);
      downGrad.addColorStop(0, 'rgba(99, 102, 241, 0.12)');
      downGrad.addColorStop(0.5, 'rgba(59, 130, 246, 0.18)');
      downGrad.addColorStop(1, 'rgba(30, 64, 175, 0.28)');
      ctx.fillStyle = downGrad;
      ctx.fill();
      ctx.strokeStyle = 'rgba(99, 102, 241, 0.45)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.stroke();
      ctx.setLineDash([]);

      // Downdraft animated downward streamlines & arrows
      if (useSimulationStore.getState().showWindField) {
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

          // Animated arrows going DOWN
          const phase = (animClock * 2.5 + col * 0.35) % 1.0;
          const arrowZ = 9.5 - phase * 9.0;
          const arrowX = engine.wind.getDowndraftX(arrowZ) + offsetKm;
          ctx.fillStyle = '#818cf8';
          ctx.beginPath();
          ctx.arc(kmToX(arrowX), kmToY(arrowZ), 3.0, 0, Math.PI * 2);
          ctx.fill();
        }

        // Downdraft Banner Badge
        ctx.fillStyle = 'rgba(129, 140, 248, 0.95)';
        ctx.font = 'bold 11px JetBrains Mono, monospace';
        ctx.fillText('▼ CORRENTE DESCENDENTE (-w: Granizo ao Solo)', kmToX(xDownBase - 2.8), kmToY(5.2));
      }
      ctx.restore();

      // Outside Downdraft Melting Annotation
      ctx.fillStyle = 'rgba(148, 163, 184, 0.7)';
      ctx.font = '10px Inter, sans-serif';
      ctx.fillText('Fora da descendente: granizo derrete e vira chuva', kmToX(1.8), kmToY(1.8));

      // 7. Isotherm Lines (0°C, -20°C, -40°C)
      if (useSimulationStore.getState().showIsotherms) {
        ctx.lineWidth = 1.2;

        // 0°C line
        ctx.strokeStyle = 'rgba(14, 165, 233, 0.85)';
        ctx.setLineDash([6, 4]);
        ctx.beginPath();
        ctx.moveTo(0, fzY);
        ctx.lineTo(width, fzY);
        ctx.stroke();

        ctx.fillStyle = '#38bdf8';
        ctx.font = 'bold 10px JetBrains Mono, monospace';
        ctx.fillText(`0°C (${engine.params.zFreezingKm.toFixed(1)} km) - Nível de Congelamento`, 8, fzY - 4);

        // -20°C line
        const yM20 = kmToY(iso.zMinus20C);
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.45)';
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(0, yM20);
        ctx.lineTo(width, yM20);
        ctx.stroke();
        ctx.fillStyle = 'rgba(148, 163, 184, 0.75)';
        ctx.font = '9px JetBrains Mono, monospace';
        ctx.fillText(`-20°C (${iso.zMinus20C.toFixed(1)} km)`, 8, yM20 - 4);

        ctx.setLineDash([]);
      }

      // 8. Trajectories of Active Particles
      if (useSimulationStore.getState().showTrajectories) {
        for (let i = 0; i < engine.particles.activeCount; i++) {
          if (engine.particles.alive[i] === 0) continue;
          const traj = engine.particles.trajectories[i];
          if (!traj || traj.length < 2) continue;

          const isSelected = i === selectedParticleId - 1;
          ctx.strokeStyle = isSelected ? 'rgba(251, 191, 36, 0.95)' : 'rgba(148, 163, 184, 0.2)';
          ctx.lineWidth = isSelected ? 2.2 : 0.9;

          ctx.beginPath();
          ctx.moveTo(kmToX(traj[0].x), kmToY(traj[0].z));
          for (let k = 1; k < traj.length; k++) {
            ctx.lineTo(kmToX(traj[k].x), kmToY(traj[k].z));
          }
          ctx.stroke();
        }
      }

      // 9. Hydrometeor Particles
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

        const radius = Math.max(3.0, Math.min(24, (diam / 2.0) * 0.85));

        ctx.save();

        if (type === ParticleType.RAIN) {
          ctx.fillStyle = '#38bdf8';
          ctx.beginPath();
          ctx.arc(px, py, Math.max(2.2, radius * 0.65), 0, Math.PI * 2);
          ctx.fill();
        } else if (type === ParticleType.GRAUPEL) {
          ctx.fillStyle = '#f8fafc';
          ctx.beginPath();
          ctx.arc(px, py, radius, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#94a3b8';
          ctx.lineWidth = 1.0;
          ctx.stroke();
        } else {
          // Hailstone
          if (regime === GrowthRegime.DRY) {
            ctx.fillStyle = '#f1f5f9';
            ctx.beginPath();
            ctx.arc(px, py, radius, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#cbd5e1';
            ctx.lineWidth = 1.5;
            ctx.stroke();
          } else if (regime === GrowthRegime.WET) {
            const glazeGrad = ctx.createRadialGradient(px - radius * 0.3, py - radius * 0.3, radius * 0.1, px, py, radius);
            glazeGrad.addColorStop(0, '#ffffff');
            glazeGrad.addColorStop(0.5, '#7dd3fc');
            glazeGrad.addColorStop(1, '#0284c7');
            ctx.fillStyle = glazeGrad;
            ctx.beginPath();
            ctx.arc(px, py, radius, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#38bdf8';
            ctx.lineWidth = 1.5;
            ctx.stroke();
          } else {
            ctx.fillStyle = '#bae6fd';
            ctx.beginPath();
            ctx.arc(px, py, radius, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#0284c7';
            ctx.lineWidth = 1.8;
            ctx.stroke();
          }

          if (loops > 0 && radius > 5) {
            ctx.strokeStyle = regime === GrowthRegime.DRY ? '#94a3b8' : '#ffffff';
            ctx.lineWidth = 1.0;
            ctx.beginPath();
            ctx.arc(px, py, radius * 0.55, 0, Math.PI * 2);
            ctx.stroke();
          }
        }

        if (isSelected) {
          ctx.strokeStyle = '#f59e0b';
          ctx.lineWidth = 2.0;
          ctx.beginPath();
          ctx.arc(px, py, radius + 5.0, 0, Math.PI * 2);
          ctx.stroke();

          ctx.fillStyle = '#f59e0b';
          ctx.font = 'bold 10px JetBrains Mono, monospace';
          ctx.fillText(`P${i + 1} (${diam.toFixed(1)}mm • ${loops} voltas)`, px + radius + 7, py + 3);
        }

        ctx.restore();
      }

      // 10. Ground Surface Line & Labels
      ctx.fillStyle = '#090d16';
      ctx.fillRect(0, groundY, width, height - groundY);
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 2.0;
      ctx.beginPath();
      ctx.moveTo(0, groundY);
      ctx.lineTo(width, groundY);
      ctx.stroke();

      ctx.fillStyle = '#94a3b8';
      ctx.font = '10px JetBrains Mono, monospace';
      ctx.fillText('0 km (Solo)', 10, groundY + 16);

      ctx.fillStyle = '#818cf8';
      ctx.fillText('Impacto de Granizo Intacto (Downdraft)', kmToX(xDownBase - 2.5), groundY + 16);

      ctx.fillStyle = '#38bdf8';
      ctx.fillText('Chuva (Derretido fora do downdraft)', kmToX(1.8), groundY + 16);

      animFrameId = requestAnimationFrame(render);
    };

    animFrameId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animFrameId);
    };
  }, [params, selectedParticleId, selectParticle, updateTelemetry, updateGroundStats]);

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
    let minDistanceSq = 8.0;

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
          Corte Vertical 2D • Dupla Corrente (Ascendente + Descendente)
        </span>
        <span className="text-[10px] text-slate-400 font-mono hidden sm:inline">
          Clique em qualquer pedra para rastrear seus ciclos
        </span>
      </div>
    </div>
  );
};
