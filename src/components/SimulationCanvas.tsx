import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useSimulationStore } from '../store/simulationStore';
import { SimulationEngine } from '../simulation/SimulationEngine';
import { ParticleType, GrowthRegime } from '../types/simulationTypes';

export const SimulationCanvas: React.FC = () => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<SimulationEngine | null>(null);

  const params = useSimulationStore((state) => state.params);
  const isRunning = useSimulationStore((state) => state.isRunning);
  const showTrajectories = useSimulationStore((state) => state.showTrajectories);
  const showIsotherms = useSimulationStore((state) => state.showIsotherms);
  const showWindField = useSimulationStore((state) => state.showWindField);
  const selectedParticleId = useSimulationStore((state) => state.selectedParticleId);

  const selectParticle = useSimulationStore((state) => state.selectParticle);
  const updateTelemetry = useSimulationStore((state) => state.updateTelemetry);
  const updateGroundStats = useSimulationStore((state) => state.updateGroundStats);

  // Initialize and preserve single SimulationEngine instance
  if (!engineRef.current) {
    engineRef.current = new SimulationEngine(params);
  }

  // Keep engine parameters synchronized
  useEffect(() => {
    if (engineRef.current) {
      engineRef.current.params = { ...params };
    }
  }, [params]);

  // Main 60 FPS Canvas 2D Loop with High-DPI support
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

      // Physics update if unpaused
      if (useSimulationStore.getState().isRunning) {
        engine.update(dtSec);
      }

      // Sync React state throttled to ~8 Hz
      if (now - lastReactSync > 120) {
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

      // Visual Canvas Dimensions
      const width = canvas.width;
      const height = canvas.height;

      // Coordinate scaling:
      // X domain: 0 to 22 km mapped to [0, width]
      // Z domain: 0 to 14 km mapped to [groundY, topY]
      const groundY = height - 42;
      const topY = 28;
      const kmToX = (xKm: number) => (xKm / 22.0) * width;
      const kmToY = (zKm: number) => groundY - (zKm / 14.0) * (groundY - topY);

      // 1. Clear & Background Sky
      const skyGrad = ctx.createLinearGradient(0, 0, 0, height);
      skyGrad.addColorStop(0, '#030712');
      skyGrad.addColorStop(0.65, '#090d16');
      skyGrad.addColorStop(1, '#0f172a');
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, width, height);

      // 2. Warm Lower Layer (T > 0°C) Tint
      const fzY = kmToY(engine.params.zFreezingKm);
      ctx.fillStyle = 'rgba(239, 68, 68, 0.05)';
      ctx.fillRect(0, fzY, width, groundY - fzY);

      // 3. Hail Growth Zone (-10°C to -30°C) Highlight
      const iso = engine.atmos.getIsothermAltitudes(engine.params.zFreezingKm);
      const yM10 = kmToY(iso.zMinus10C);
      const yM30 = kmToY(iso.zMinus30C);
      ctx.fillStyle = 'rgba(14, 165, 233, 0.07)';
      ctx.fillRect(kmToX(1.0), yM30, kmToX(20.0), yM10 - yM30);

      // Growth Zone Border
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.25)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.strokeRect(kmToX(1.0), yM30, kmToX(20.0), yM10 - yM30);
      ctx.setLineDash([]);

      // Label for Growth Zone
      ctx.fillStyle = 'rgba(56, 189, 248, 0.6)';
      ctx.font = '10px Inter, sans-serif';
      ctx.fillText('ZONA PRINCIPAL DE CRESCIMENTO DE GRANIZO (-10°C a -30°C)', kmToX(1.5), yM30 + 14);

      // 4. Cloud Silhouette (Nuvem Convectiva Profunda)
      const tiltX = (engine.params.updraftTiltDeg / 25.0) * 4.0;
      const xBase = 10.5;

      ctx.save();
      ctx.beginPath();
      ctx.moveTo(kmToX(xBase - 3.8), kmToY(1.2));
      // Left updraft flank
      ctx.bezierCurveTo(
        kmToX(xBase - 5.0), kmToY(4.5),
        kmToX(xBase - 5.5 + tiltX * 0.4), kmToY(8.5),
        kmToX(xBase - 7.0 + tiltX), kmToY(12.2)
      );
      // Anvil top with overshooting dome
      ctx.bezierCurveTo(
        kmToX(xBase - 3.5 + tiltX), kmToY(13.4),
        kmToX(xBase + 3.5 + tiltX), kmToY(13.2),
        kmToX(xBase + 8.5 + tiltX), kmToY(11.5)
      );
      // Right downdraft / anvil flank
      ctx.bezierCurveTo(
        kmToX(xBase + 6.2 + tiltX * 0.6), kmToY(8.0),
        kmToX(xBase + 5.2), kmToY(4.0),
        kmToX(xBase + 4.2), kmToY(1.2)
      );
      ctx.closePath();

      // Cloud body gradient
      const cloudGrad = ctx.createLinearGradient(0, kmToY(13.0), 0, kmToY(1.0));
      cloudGrad.addColorStop(0, 'rgba(30, 41, 59, 0.88)');
      cloudGrad.addColorStop(0.4, 'rgba(15, 23, 42, 0.92)');
      cloudGrad.addColorStop(1, 'rgba(30, 41, 59, 0.85)');
      ctx.fillStyle = cloudGrad;
      ctx.fill();
      ctx.strokeStyle = 'rgba(71, 85, 105, 0.5)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.restore();

      // 5. Isotherms (Linhas de Temperatura)
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
        ctx.fillStyle = 'rgba(148, 163, 184, 0.8)';
        ctx.font = '9px JetBrains Mono, monospace';
        ctx.fillText(`-20°C (${iso.zMinus20C.toFixed(1)} km)`, 8, yM20 - 4);

        // -40°C line (Homogeneous freezing limit)
        const yM40 = kmToY(iso.zMinus40C);
        ctx.strokeStyle = 'rgba(96, 165, 250, 0.35)';
        ctx.beginPath();
        ctx.moveTo(0, yM40);
        ctx.lineTo(width, yM40);
        ctx.stroke();
        ctx.fillText(`-40°C (${iso.zMinus40C.toFixed(1)} km) - Congelamento Espontâneo`, 8, yM40 - 4);

        ctx.setLineDash([]);
      }

      // 6. Wind Field Streamlines
      if (useSimulationStore.getState().showWindField) {
        ctx.save();
        const coreX = xBase + (tiltX * 0.5);
        for (let col = -2; col <= 2; col++) {
          const streamX = coreX + col * 1.1;
          ctx.beginPath();
          ctx.strokeStyle = 'rgba(56, 189, 248, 0.22)';
          ctx.lineWidth = 1.2;

          let sx = streamX;
          let sz = 1.2;
          ctx.moveTo(kmToX(sx), kmToY(sz));

          for (let step = 0; step < 16; step++) {
            const { u, w } = engine.wind.evaluate(sx, sz, engine.simTimeSec, engine.params);
            sx += (u * 0.25) / 10.0;
            sz += (w * 0.25) / 10.0;
            if (sz > 13.0 || sx < 1.0 || sx > 21.0) break;
            ctx.lineTo(kmToX(sx), kmToY(sz));
          }
          ctx.stroke();

          // Animated particle moving along stream
          const offset = ((animClock * 1.5 + col * 0.4) % 1.0);
          const tracerZ = 1.5 + offset * 10.5;
          const tracerX = streamX + (tracerZ / 12.0) * tiltX * 0.6;
          ctx.fillStyle = 'rgba(56, 189, 248, 0.65)';
          ctx.beginPath();
          ctx.arc(kmToX(tracerX), kmToY(tracerZ), 2.0, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }

      // 7. Trajectories of Active Particles
      if (useSimulationStore.getState().showTrajectories) {
        ctx.lineWidth = 1.2;
        for (let i = 0; i < engine.particles.activeCount; i++) {
          if (engine.particles.alive[i] === 0) continue;
          const traj = engine.particles.trajectories[i];
          if (!traj || traj.length < 2) continue;

          const isSelected = i === selectedParticleId - 1;
          ctx.strokeStyle = isSelected ? 'rgba(251, 191, 36, 0.85)' : 'rgba(148, 163, 184, 0.18)';
          ctx.lineWidth = isSelected ? 2.0 : 0.8;

          ctx.beginPath();
          ctx.moveTo(kmToX(traj[0].x), kmToY(traj[0].z));
          for (let k = 1; k < traj.length; k++) {
            ctx.lineTo(kmToX(traj[k].x), kmToY(traj[k].z));
          }
          ctx.stroke();
        }
      }

      // 8. Hydrometeor Particles (Nuvem, SLW, Graupel, Granizo em Camadas)
      const count = engine.particles.activeCount;
      for (let i = 0; i < count; i++) {
        if (engine.particles.alive[i] === 0) continue;

        const px = kmToX(engine.particles.positionsX[i]);
        const py = kmToY(engine.particles.positionsZ[i]);
        const diam = engine.particles.diameters[i];
        const type = engine.particles.types[i] as ParticleType;
        const regime = engine.particles.regimes[i] as GrowthRegime;
        const isSelected = i === selectedParticleId - 1;

        // Base pixel radius with minimum visible size
        const radius = Math.max(2.5, Math.min(22, (diam / 2.0) * 0.75));

        ctx.save();

        if (type === ParticleType.DROP || type === ParticleType.RAIN) {
          // Liquid raindrop
          ctx.fillStyle = '#38bdf8';
          ctx.beginPath();
          ctx.arc(px, py, Math.max(2.0, radius * 0.6), 0, Math.PI * 2);
          ctx.fill();
        } else if (type === ParticleType.SLW_DROP) {
          // Supercooled liquid droplet
          ctx.fillStyle = '#06b6d4';
          ctx.beginPath();
          ctx.arc(px, py, 2.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#67e8f9';
          ctx.lineWidth = 0.8;
          ctx.stroke();
        } else if (type === ParticleType.ICE_CRYSTAL) {
          // Ice crystal
          ctx.fillStyle = '#e2e8f0';
          ctx.beginPath();
          ctx.arc(px, py, 2.2, 0, Math.PI * 2);
          ctx.fill();
        } else if (type === ParticleType.GRAUPEL) {
          // Porous rime embryo (snow pellet)
          ctx.fillStyle = '#f8fafc';
          ctx.beginPath();
          ctx.arc(px, py, Math.max(3.0, radius), 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#94a3b8';
          ctx.lineWidth = 1.0;
          ctx.stroke();
        } else {
          // Layered Hailstone (> 5 mm)
          // Outer core depending on growth regime:
          if (regime === GrowthRegime.DRY) {
            // Rime growth: Opaque milky white with trapped air bubbles
            ctx.fillStyle = '#f1f5f9';
            ctx.beginPath();
            ctx.arc(px, py, radius, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#cbd5e1';
            ctx.lineWidth = 1.5;
            ctx.stroke();
          } else if (regime === GrowthRegime.WET) {
            // Glaze growth: Translucent glassy ice with specular shine
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
            // Melting regime below freezing level: liquid water film sheath
            ctx.fillStyle = '#bae6fd';
            ctx.beginPath();
            ctx.arc(px, py, radius, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#0284c7';
            ctx.lineWidth = 2.0;
            ctx.stroke();
          }

          // Visible Onion-Skin Layer Ring for larger stones
          if (radius > 6) {
            ctx.strokeStyle = regime === GrowthRegime.DRY ? '#94a3b8' : '#ffffff';
            ctx.lineWidth = 1.0;
            ctx.beginPath();
            ctx.arc(px, py, radius * 0.55, 0, Math.PI * 2);
            ctx.stroke();
          }
        }

        // Selected particle target highlight ring
        if (isSelected) {
          ctx.strokeStyle = '#f59e0b';
          ctx.lineWidth = 2.0;
          ctx.beginPath();
          ctx.arc(px, py, radius + 5.0, 0, Math.PI * 2);
          ctx.stroke();

          ctx.fillStyle = '#f59e0b';
          ctx.font = 'bold 10px JetBrains Mono, monospace';
          ctx.fillText(`P${i + 1} (${diam.toFixed(1)}mm)`, px + radius + 7, py + 3);
        }

        ctx.restore();
      }

      // 9. Ground Surface Line & Depth
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, groundY, width, height - groundY);
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 2.0;
      ctx.beginPath();
      ctx.moveTo(0, groundY);
      ctx.lineTo(width, groundY);
      ctx.stroke();

      // Ground Labels
      ctx.fillStyle = '#64748b';
      ctx.font = '10px JetBrains Mono, monospace';
      ctx.fillText('0 km (Superfície)', 10, groundY + 16);
      ctx.fillText(`Granizo no Solo: ${engine.groundStats.totalGrounded}`, width - 180, groundY + 16);

      animFrameId = requestAnimationFrame(render);
    };

    animFrameId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animFrameId);
    };
  }, [params, selectedParticleId, selectParticle, updateTelemetry, updateGroundStats]);

  // Handle click on canvas to select stone
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const clickX = ((e.clientX - rect.left) / rect.width) * canvas.width;
    const clickY = ((e.clientY - rect.top) / rect.height) * canvas.height;

    const width = canvas.width;
    const height = canvas.height;
    const groundY = height - 42;
    const topY = 28;

    const clickXKm = (clickX / width) * 22.0;
    const clickZKm = Math.max(0, ((groundY - clickY) / (groundY - topY)) * 14.0);

    const engine = engineRef.current;
    if (!engine) return;

    let closestId = 1;
    let minDistanceSq = 6.0; // km threshold

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
        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-900/80 text-cyan-400 border border-slate-700/60 backdrop-blur-sm">
          Corte Vertical 2D: 0 a 14 km
        </span>
        <span className="text-[10px] text-slate-400 font-mono hidden sm:inline">
          Clique em qualquer pedra para rastreá-la
        </span>
      </div>
    </div>
  );
};
