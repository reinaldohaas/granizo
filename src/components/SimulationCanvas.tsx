import React, { useEffect, useRef } from 'react';
import { Application, Graphics } from 'pixi.js';
import { useSimulationStore } from '../store/simulationStore';
import { SimulationEngine } from '../simulation/SimulationEngine';
import { ParticleType, GrowthRegime } from '../types/simulationTypes';

export const SimulationCanvas: React.FC = () => {
  const containerRef = useRef<HTMLDivElement | null>(null);
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

  // Keep engine parameters in sync with store
  useEffect(() => {
    if (engineRef.current) {
      engineRef.current.params = { ...params };
    }
  }, [params]);

  useEffect(() => {
    let app: Application | null = null;
    let isCancelled = false;

    const initPixi = async () => {
      const container = containerRef.current;
      if (!container) return;

      const width = container.clientWidth || 980;
      const height = 620;

      // PixiJS v8 Application initialization
      app = new Application();
      await app.init({
        width,
        height,
        backgroundColor: 0x030712,
        antialias: true,
        resolution: window.devicePixelRatio || 1,
        autoDensity: true
      });

      if (isCancelled) {
        app.destroy(true, { children: true });
        return;
      }

      container.innerHTML = '';
      container.appendChild(app.canvas);

      // Graphics display layers
      const bgGraphics = new Graphics();
      const cloudGraphics = new Graphics();
      const windGraphics = new Graphics();
      const trajectoryGraphics = new Graphics();
      const particleGraphics = new Graphics();
      const hudGraphics = new Graphics();

      app.stage.addChild(bgGraphics);
      app.stage.addChild(cloudGraphics);
      app.stage.addChild(windGraphics);
      app.stage.addChild(trajectoryGraphics);
      app.stage.addChild(particleGraphics);
      app.stage.addChild(hudGraphics);

      // Coordinate scaling:
      // X domain: 0 to 22 km mapped to [0, width]
      // Z domain: 0 to 14 km mapped to [height - 40, 20]
      const groundY = height - 40;
      const topY = 20;
      const kmToX = (xKm: number) => (xKm / 22.0) * width;
      const kmToY = (zKm: number) => groundY - (zKm / 14.0) * (groundY - topY);

      const xToKm = (xPx: number) => (xPx / width) * 22.0;
      const yToKm = (yPx: number) => Math.max(0, ((groundY - yPx) / (groundY - topY)) * 14.0);

      // Click listener for particle selection
      app.canvas.addEventListener('click', (e: MouseEvent) => {
        const rect = app!.canvas.getBoundingClientRect();
        const clickXKm = xToKm(e.clientX - rect.left);
        const clickZKm = yToKm(e.clientY - rect.top);

        const engine = engineRef.current;
        if (!engine) return;

        let closestId = 1;
        let minDistanceSq = 4.0; // km^2 threshold

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
      });

      // Throttle timer for React state sync (8 Hz = 125ms)
      let lastReactSync = 0;
      let animTime = 0;

      // Main PixiJS Ticker animation loop
      app.ticker.add((ticker) => {
        const engine = engineRef.current;
        if (!engine) return;

        const dtSec = Math.min(0.05, ticker.deltaMS / 1000.0);
        animTime += dtSec;

        if (useSimulationStore.getState().isRunning) {
          engine.update(dtSec);
        }

        const now = performance.now();
        if (now - lastReactSync > 120) {
          lastReactSync = now;
          const selIdx = useSimulationStore.getState().selectedParticleId - 1;
          if (selIdx >= 0 && selIdx < engine.particles.activeCount) {
            const z = engine.particles.positionsZ[selIdx];
            const T = engine.atmos.getTemperature(z, engine.params.zFreezingKm);
            const { w } = engine.wind.evaluate(engine.particles.positionsX[selIdx], z, engine.simTimeSec, engine.params);
            const rhoAir = engine.atmos.getAirDensity(z);
            const diam = engine.particles.diameters[selIdx];
            const vt = 9.0 * Math.sqrt(Math.max(0.1, diam / 10.0)) * Math.sqrt(1.225 / rhoAir);

            updateTelemetry(engine.particles.getTelemetry(selIdx, T, w, vt));
          }
          updateGroundStats(engine.groundStats);
        }

        // 1. Render Background & Isotherms
        bgGraphics.clear();
        const fzY = kmToY(engine.params.zFreezingKm);

        // Warm lower layer shade (T > 0°C)
        bgGraphics.rect(0, fzY, width, groundY - fzY);
        bgGraphics.fill({ color: 0x1e1b2e, alpha: 0.45 });

        // Ground surface
        bgGraphics.rect(0, groundY, width, height - groundY);
        bgGraphics.fill({ color: 0x090d16 });
        bgGraphics.stroke({ color: 0x334155, width: 2 });

        // Primary hail growth zone (-10°C to -30°C)
        const iso = engine.atmos.getIsothermAltitudes(engine.params.zFreezingKm);
        const yM10 = kmToY(iso.zMinus10C);
        const yM30 = kmToY(iso.zMinus30C);

        bgGraphics.rect(kmToX(1.5), yM30, kmToX(19.0), yM10 - yM30);
        bgGraphics.fill({ color: 0x0284c7, alpha: 0.08 });
        bgGraphics.stroke({ color: 0x38bdf8, width: 1, alpha: 0.35 });

        if (useSimulationStore.getState().showIsotherms) {
          // 0°C line (Freezing level)
          bgGraphics.moveTo(0, fzY);
          bgGraphics.lineTo(width, fzY);
          bgGraphics.stroke({ color: 0x0ea5e9, width: 1.8, alpha: 0.8 });

          // -20°C line
          const yM20 = kmToY(iso.zMinus20C);
          bgGraphics.moveTo(0, yM20);
          bgGraphics.lineTo(width, yM20);
          bgGraphics.stroke({ color: 0x38bdf8, width: 1.2, alpha: 0.5 });

          // -40°C line
          const yM40 = kmToY(iso.zMinus40C);
          bgGraphics.moveTo(0, yM40);
          bgGraphics.lineTo(width, yM40);
          bgGraphics.stroke({ color: 0x60a5fa, width: 1.0, alpha: 0.4 });
        }

        // 2. Render Cloud Silhouette
        cloudGraphics.clear();
        const tiltX = (engine.params.updraftTiltDeg / 25.0) * 4.0; // km
        const xBase = 10.0;

        cloudGraphics.moveTo(kmToX(xBase - 3.5), kmToY(1.2));
        // Flank curves
        cloudGraphics.bezierCurveTo(
          kmToX(xBase - 4.5), kmToY(4.5),
          kmToX(xBase - 5.0 + tiltX * 0.4), kmToY(8.5),
          kmToX(xBase - 6.5 + tiltX), kmToY(12.2)
        );
        // Anvil top
        cloudGraphics.bezierCurveTo(
          kmToX(xBase - 3.0 + tiltX), kmToY(13.2),
          kmToX(xBase + 4.0 + tiltX), kmToY(13.0),
          kmToX(xBase + 8.5 + tiltX), kmToY(11.4)
        );
        // Right flank
        cloudGraphics.bezierCurveTo(
          kmToX(xBase + 6.0 + tiltX * 0.6), kmToY(8.0),
          kmToX(xBase + 5.0), kmToY(4.0),
          kmToX(xBase + 4.0), kmToY(1.2)
        );
        cloudGraphics.closePath();
        cloudGraphics.fill({ color: 0x1e293b, alpha: 0.72 });
        cloudGraphics.stroke({ color: 0x475569, width: 1.5, alpha: 0.4 });

        // 3. Render Wind Field Streamlines
        windGraphics.clear();
        if (useSimulationStore.getState().showWindField) {
          const halfW = engine.params.updraftWidthKm / 2;
          for (let s = -2; s <= 2; s++) {
            const offset = (s / 2.0) * halfW;
            const x0 = kmToX(xBase + offset);
            const xTop = kmToX(xBase + tiltX + offset);

            windGraphics.moveTo(x0, kmToY(1.2));
            windGraphics.bezierCurveTo(x0, kmToY(5.0), xTop, kmToY(9.0), xTop, kmToY(12.4));
            windGraphics.stroke({ color: 0x38bdf8, width: s === 0 ? 2 : 1.2, alpha: s === 0 ? 0.45 : 0.25 });

            // Moving pulse arrows
            const speed = (engine.params.wMax / 38.0) * 120.0;
            const headY = kmToY(1.2) - ((animTime * speed + (s + 2) * 80) % (kmToY(1.2) - kmToY(12.4)));
            const midX = x0 + (xTop - x0) * ((kmToY(1.2) - headY) / (kmToY(1.2) - kmToY(12.4)));

            windGraphics.moveTo(midX - 3.5, headY + 5);
            windGraphics.lineTo(midX, headY);
            windGraphics.lineTo(midX + 3.5, headY + 5);
            windGraphics.stroke({ color: 0x38bdf8, width: 1.8, alpha: 0.8 });
          }
        }

        // 4. Render Selected Trajectory
        trajectoryGraphics.clear();
        const selId = useSimulationStore.getState().selectedParticleId - 1;
        if (useSimulationStore.getState().showTrajectories && selId >= 0 && selId < engine.particles.activeCount) {
          const traj = engine.particles.trajectories[selId];
          if (traj && traj.length > 2) {
            trajectoryGraphics.moveTo(kmToX(traj[0].x), kmToY(traj[0].z));
            for (let t = 1; t < traj.length; t++) {
              trajectoryGraphics.lineTo(kmToX(traj[t].x), kmToY(traj[t].z));
            }
            trajectoryGraphics.stroke({ color: 0xf59e0b, width: 2.2, alpha: 0.85 });
          }
        }

        // 5. Render Active Particles
        particleGraphics.clear();
        hudGraphics.clear();

        for (let i = 0; i < engine.particles.activeCount; i++) {
          if (engine.particles.alive[i] === 0) continue;

          const px = kmToX(engine.particles.positionsX[i]);
          const py = kmToY(engine.particles.positionsZ[i]);
          const diam = engine.particles.diameters[i];
          const type = engine.particles.types[i] as ParticleType;
          const radius = Math.max(2.0, Math.min(22.0, diam * 0.85));

          if (type === ParticleType.DROP) {
            // Warm liquid drop: Royal Blue
            particleGraphics.circle(px, py, radius);
            particleGraphics.fill({ color: 0x2563eb });
          } else if (type === ParticleType.SLW_DROP) {
            // Supercooled Liquid Water: Glowing Cyan
            particleGraphics.circle(px, py, radius);
            particleGraphics.fill({ color: 0x38bdf8, alpha: 0.95 });
          } else if (type === ParticleType.ICE_CRYSTAL) {
            // Ice Crystal: White diamond
            particleGraphics.moveTo(px, py - radius);
            particleGraphics.lineTo(px + radius, py);
            particleGraphics.lineTo(px, py + radius);
            particleGraphics.lineTo(px - radius, py);
            particleGraphics.closePath();
            particleGraphics.fill({ color: 0xffffff });
          } else if (type === ParticleType.GRAUPEL) {
            // Graupel: Porous white sphere
            particleGraphics.circle(px, py, radius);
            particleGraphics.fill({ color: 0xe2e8f0 });
            particleGraphics.stroke({ color: 0x94a3b8, width: 1 });
          } else if (type === ParticleType.HAIL) {
            // Layered Hail: Dense layered concentric circle
            particleGraphics.circle(px, py, radius);
            particleGraphics.fill({ color: 0xf8fafc });
            particleGraphics.stroke({ color: 0x475569, width: 1.2 });

            // Concentric ring indicators
            const layers = Math.min(5, engine.particles.layers[i]);
            for (let l = 1; l <= layers; l++) {
              particleGraphics.circle(px, py, (radius / layers) * l);
              particleGraphics.stroke({ color: l % 2 === 0 ? 0x38bdf8 : 0xffffff, width: 1 });
            }
          } else if (type === ParticleType.RAIN) {
            // Melted Rain Drop: elongated
            particleGraphics.ellipse(px, py, 1.8, 3.8);
            particleGraphics.fill({ color: 0x38bdf8, alpha: 0.8 });
          }

          // Target reticle on selected stone
          if (i === selId) {
            hudGraphics.circle(px, py, radius + 5);
            hudGraphics.stroke({ color: 0xf59e0b, width: 1.8 });
            hudGraphics.moveTo(px - radius - 8, py); hudGraphics.lineTo(px - radius - 3, py);
            hudGraphics.moveTo(px + radius + 3, py); hudGraphics.lineTo(px + radius + 8, py);
            hudGraphics.moveTo(px, py - radius - 8); hudGraphics.lineTo(px, py - radius - 3);
            hudGraphics.moveTo(px, py + radius + 3); hudGraphics.lineTo(px, py + radius + 8);
            hudGraphics.stroke({ color: 0xf59e0b, width: 1.5 });
          }
        }
      });
    };

    initPixi();

    return () => {
      isCancelled = true;
      if (app) {
        app.destroy(true, { children: true });
      }
    };
  }, [selectParticle, updateTelemetry, updateGroundStats]);

  return (
    <div className="relative w-full h-[620px] rounded-2xl overflow-hidden border border-slate-800 bg-slate-950 shadow-2xl">
      <div ref={containerRef} className="w-full h-full block cursor-crosshair" />
    </div>
  );
};
