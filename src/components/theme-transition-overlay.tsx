'use client';

import React, { useEffect, useRef, useCallback } from 'react';
import { THEME_TRANSITION_CONFIG } from '@/config/theme-transition.config';

interface TransitionOrigin {
  x: number;
  y: number;
}

interface TransitionEventDetail {
  origin: TransitionOrigin;
  targetTheme: 'dark' | 'light';
  currentTheme: 'dark' | 'light';
}

interface TendrilSeed {
  baseAngle: number;
  angleSpread: number;
  lengthScale: number;
  wiggleFreq1: number;
  wiggleFreq2: number;
  phase1: number;
  phase2: number;
  colorType: 'magenta' | 'violet' | 'cyan' | 'purple';
  branches: Array<{
    splitProgress: number;
    angleOffset: number;
    lengthRatio: number;
  }>;
}

interface Spark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  alpha: number;
  color: string;
}

export function ThemeTransitionOverlay() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const isRunningRef = useRef<boolean>(false);
  const finishTransitionRef = useRef<(() => void) | null>(null);

  // Generate deterministic tendril seeds
  const tendrilsRef = useRef<TendrilSeed[]>([]);
  const sparksRef = useRef<Spark[]>([]);

  const initSeeds = useCallback(() => {
    const { count } = THEME_TRANSITION_CONFIG.tendrils;
    const seeds: TendrilSeed[] = [];
    const colors: Array<'magenta' | 'violet' | 'cyan' | 'purple'> = [
      'magenta',
      'violet',
      'cyan',
      'purple',
    ];

    for (let i = 0; i < count; i++) {
      const baseAngle = (i / count) * Math.PI * 2;
      const angleSpread = (Math.random() - 0.5) * 0.25;
      const lengthScale = 0.75 + Math.random() * 0.55;
      const colorType = colors[i % colors.length];

      seeds.push({
        baseAngle,
        angleSpread,
        lengthScale,
        wiggleFreq1: 2 + Math.random() * 3,
        wiggleFreq2: 4 + Math.random() * 4,
        phase1: Math.random() * Math.PI * 2,
        phase2: Math.random() * Math.PI * 2,
        colorType,
        branches: [
          {
            splitProgress: 0.35 + Math.random() * 0.15,
            angleOffset: (Math.random() > 0.5 ? 1 : -1) * (0.35 + Math.random() * 0.3),
            lengthRatio: 0.5 + Math.random() * 0.3,
          },
          {
            splitProgress: 0.65 + Math.random() * 0.15,
            angleOffset: (Math.random() > 0.5 ? -1 : 1) * (0.4 + Math.random() * 0.35),
            lengthRatio: 0.4 + Math.random() * 0.3,
          },
        ],
      });
    }
    tendrilsRef.current = seeds;
  }, []);

  const runTransition = useCallback(
    ({ origin, targetTheme }: TransitionEventDetail) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Check reduced motion preference
      if (
        typeof window !== 'undefined' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches
      ) {
        document.documentElement.classList.remove('light', 'dark');
        document.documentElement.classList.add(targetTheme);
        return;
      }

      // If already running, cancel the previous loop cleanly
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }
      if (finishTransitionRef.current) {
        finishTransitionRef.current();
        finishTransitionRef.current = null;
      }

      isRunningRef.current = true;
      initSeeds();

      const width = (canvas.width = window.innerWidth);
      const height = (canvas.height = window.innerHeight);

      const {
        totalDurationMs,
        formationDurationMs,
        expansionDurationMs,
        dissipationDurationMs,
        colors,
      } = THEME_TRANSITION_CONFIG;

      // Furthest corner distance
      const maxRadius =
        Math.hypot(
          Math.max(origin.x, width - origin.x),
          Math.max(origin.y, height - origin.y)
        ) * 1.35;

      const startTime = performance.now();
      let hasFinishedViewTransition = false;

      // Check if startViewTransition is available
      const supportsViewTransition =
        typeof document !== 'undefined' &&
        typeof (document as any).startViewTransition === 'function';

      // Set initial 0px clip
      document.documentElement.style.setProperty(
        '--theme-wave-clip',
        `circle(0px at ${origin.x}px ${origin.y}px)`
      );

      if (supportsViewTransition) {
        const transitionPromise = new Promise<void>((resolve) => {
          finishTransitionRef.current = resolve;
        });

        (document as any).startViewTransition(async () => {
          document.documentElement.classList.remove('light', 'dark');
          document.documentElement.classList.add(targetTheme);
          await transitionPromise;
        });
      }

      // Initialize energy sparks around origin
      sparksRef.current = Array.from({ length: 48 }, () => ({
        x: origin.x + (Math.random() - 0.5) * 40,
        y: origin.y + (Math.random() - 0.5) * 40,
        vx: (Math.random() - 0.5) * 2.0,
        vy: (Math.random() - 0.5) * 2.0,
        radius: 1 + Math.random() * 2.5,
        alpha: 0.7 + Math.random() * 0.3,
        color: Math.random() > 0.4 ? colors.electricMagenta : colors.electricCyan,
      }));

      const surfaceFill =
        targetTheme === 'dark' ? colors.darkSurface : colors.lightSurface;

      const getColorStr = (type: string, alpha: number) => {
        switch (type) {
          case 'magenta':
            return `rgba(217, 70, 239, ${alpha})`;
          case 'violet':
            return `rgba(168, 85, 247, ${alpha})`;
          case 'cyan':
            return `rgba(56, 189, 248, ${alpha})`;
          case 'purple':
          default:
            return `rgba(124, 58, 237, ${alpha})`;
        }
      };

      const animate = (currentTime: number) => {
        const elapsed = currentTime - startTime;
        const progress = Math.min(1.0, elapsed / totalDurationMs);

        ctx.clearRect(0, 0, width, height);

        // Stage 1: Formation (0 -> formationDurationMs)
        const tStage1 = Math.min(1.0, elapsed / formationDurationMs);

        // Stage 2: Spreading wave (formationDurationMs -> formationDurationMs + expansionDurationMs)
        const waveElapsed = Math.max(0, elapsed - formationDurationMs);
        const tWave = Math.min(1.0, waveElapsed / expansionDurationMs);
        const waveExpansionProgress = Math.pow(tWave, 1.4);
        const currentBaseRadius = maxRadius * waveExpansionProgress;

        // Stage 4: Dissipation alpha
        const postWaveElapsed = Math.max(
          0,
          elapsed - (formationDurationMs + expansionDurationMs)
        );
        const tDissipate = Math.min(1.0, postWaveElapsed / dissipationDurationMs);
        const tendrilAlpha = Math.max(0, 1.0 - tDissipate);

        // Compute organic polygon points for clipping & canvas crest
        const polygonPoints: Array<{ x: number; y: number }> = [];
        const angleSteps = 48;
        const timeScale = elapsed * 0.0025;

        for (let step = 0; step < angleSteps; step++) {
          const theta = (step / angleSteps) * Math.PI * 2;
          const noise =
            Math.sin(theta * 3 + timeScale) * 0.12 +
            Math.cos(theta * 5 - timeScale * 1.2) * 0.08 +
            Math.sin(theta * 8 + timeScale * 0.8) * 0.04;

          const r = Math.max(0, currentBaseRadius * (1 + noise));
          const px = Math.round(origin.x + Math.cos(theta) * r);
          const py = Math.round(origin.y + Math.sin(theta) * r);
          polygonPoints.push({ x: px, y: py });
        }

        // Update CSS clip-path for ::view-transition-new(root)
        if (supportsViewTransition && currentBaseRadius > 0 && !hasFinishedViewTransition) {
          const polygonStr = `polygon(${polygonPoints.map((p) => `${p.x}px ${p.y}px`).join(', ')})`;
          document.documentElement.style.setProperty('--theme-wave-clip', polygonStr);
        }

        // When wave envelopes all corners, finish view transition
        if (tWave >= 1.0 && !hasFinishedViewTransition) {
          hasFinishedViewTransition = true;
          document.documentElement.style.removeProperty('--theme-wave-clip');
          if (finishTransitionRef.current) {
            finishTransitionRef.current();
            finishTransitionRef.current = null;
          }
        }

        // -------------------------------------------------------------
        // 1. DRAW EXPANDING CELLULAR CREST & BOUNDARY
        // -------------------------------------------------------------
        if (currentBaseRadius > 2 && tendrilAlpha > 0.001) {
          ctx.save();
          ctx.beginPath();
          polygonPoints.forEach((pt, idx) => {
            if (idx === 0) ctx.moveTo(pt.x, pt.y);
            else ctx.lineTo(pt.x, pt.y);
          });
          ctx.closePath();

          // Fallback solid fill only if View Transitions not supported
          if (!supportsViewTransition) {
            ctx.fillStyle = surfaceFill;
            ctx.globalAlpha = Math.min(1.0, tWave * 1.5);
            ctx.fill();
          }

          // Luminous glowing energy boundary (Purple / Violet / Magenta / Electric White)
          // Wide soft purple/violet bloom
          ctx.globalAlpha = tendrilAlpha * 0.7;
          ctx.strokeStyle = colors.electricPurple;
          ctx.lineWidth = 16;
          ctx.shadowColor = colors.electricMagenta;
          ctx.shadowBlur = 24;
          ctx.stroke();

          // Focused vivid magenta energy crest
          ctx.globalAlpha = tendrilAlpha * 0.9;
          ctx.strokeStyle = colors.electricMagenta;
          ctx.lineWidth = 6;
          ctx.shadowColor = colors.electricViolet;
          ctx.shadowBlur = 12;
          ctx.stroke();

          // High-energy electric white core filament
          ctx.globalAlpha = tendrilAlpha * 0.95;
          ctx.strokeStyle = colors.electricWhite;
          ctx.lineWidth = 2;
          ctx.shadowBlur = 6;
          ctx.stroke();

          ctx.restore();
        }

        // -------------------------------------------------------------
        // 2. DRAW ORGANIC BRANCHING TENDRILS (Living Electric Network)
        // -------------------------------------------------------------
        if (tendrilAlpha > 0.001) {
          ctx.save();
          const seeds = tendrilsRef.current;
          const tendrilReach =
            currentBaseRadius * THEME_TRANSITION_CONFIG.tendrils.reachMultiplier +
            tStage1 * 60;

          seeds.forEach((seed) => {
            const angle = seed.baseAngle + seed.angleSpread;
            const maxLen = Math.max(35, tendrilReach * seed.lengthScale);

            const drawTendrilPath = (
              startX: number,
              startY: number,
              startAngle: number,
              totalLen: number,
              depth: number
            ) => {
              const segments = 16;
              const stepLen = totalLen / segments;
              let currX = startX;
              let currY = startY;
              let currAngle = startAngle;

              ctx.beginPath();
              ctx.moveTo(currX, currY);

              const points: Array<{ x: number; y: number; progress: number }> = [
                { x: currX, y: currY, progress: 0 },
              ];

              for (let s = 1; s <= segments; s++) {
                const segProgress = s / segments;
                const wiggle =
                  Math.sin(
                    segProgress * seed.wiggleFreq1 * Math.PI +
                      seed.phase1 +
                      elapsed * 0.003
                  ) *
                    0.18 +
                  Math.cos(
                    segProgress * seed.wiggleFreq2 * Math.PI +
                      seed.phase2 -
                      elapsed * 0.002
                  ) *
                    0.12;

                currAngle += wiggle;
                currX += Math.cos(currAngle) * stepLen;
                currY += Math.sin(currAngle) * stepLen;
                ctx.lineTo(currX, currY);
                points.push({ x: currX, y: currY, progress: segProgress });
              }

              // Tendril stroke styling
              const width = Math.max(
                1,
                (THEME_TRANSITION_CONFIG.tendrils.baseWidth / (depth + 1)) *
                  (1 - tWave * 0.3)
              );
              ctx.lineWidth = width;
              ctx.strokeStyle = getColorStr(
                seed.colorType,
                tendrilAlpha * (depth === 0 ? 0.85 : 0.65)
              );
              ctx.shadowColor = colors.electricMagenta;
              ctx.shadowBlur = 8;
              ctx.lineCap = 'round';
              ctx.lineJoin = 'round';
              ctx.stroke();

              // Electric inner highlight
              ctx.lineWidth = Math.max(0.75, width * 0.4);
              ctx.strokeStyle = `rgba(255, 255, 255, ${tendrilAlpha * 0.8})`;
              ctx.stroke();

              // Sub-branches splitting off
              if (depth < THEME_TRANSITION_CONFIG.tendrils.maxBranchDepth) {
                seed.branches.forEach((br) => {
                  const splitIndex = Math.floor(br.splitProgress * segments);
                  const splitPt = points[splitIndex];
                  if (splitPt) {
                    drawTendrilPath(
                      splitPt.x,
                      splitPt.y,
                      currAngle + br.angleOffset,
                      totalLen * br.lengthRatio,
                      depth + 1
                    );
                  }
                });
              }
            };

            // Start tendril at the organic perimeter or origin
            const originRadius = Math.max(10, currentBaseRadius * 0.88);
            const startX = origin.x + Math.cos(angle) * (tWave > 0.05 ? originRadius : 0);
            const startY = origin.y + Math.sin(angle) * (tWave > 0.05 ? originRadius : 0);

            drawTendrilPath(startX, startY, angle, maxLen, 0);
          });

          ctx.restore();
        }

        // -------------------------------------------------------------
        // 3. DRAW GLOWING CENTRAL ENERGY CORE (Stage 1 & Pulsing Core)
        // -------------------------------------------------------------
        const coreIntensity = Math.max(0, 1 - progress * 1.5);
        if (coreIntensity > 0.01) {
          ctx.save();
          const coreRadius = 24 + 18 * Math.sin(elapsed * 0.008) + tStage1 * 20;
          const coreGrad = ctx.createRadialGradient(
            origin.x,
            origin.y,
            0,
            origin.x,
            origin.y,
            coreRadius * 2
          );
          coreGrad.addColorStop(0, 'rgba(255, 255, 255, 0.98)');
          coreGrad.addColorStop(0.25, 'rgba(217, 70, 239, 0.85)');
          coreGrad.addColorStop(0.6, 'rgba(168, 85, 247, 0.45)');
          coreGrad.addColorStop(1, 'rgba(124, 58, 237, 0)');

          ctx.fillStyle = coreGrad;
          ctx.globalAlpha = coreIntensity;
          ctx.beginPath();
          ctx.arc(origin.x, origin.y, coreRadius * 2, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }

        // -------------------------------------------------------------
        // 4. DRAW FLOATING PARTICLES & SPARKS
        // -------------------------------------------------------------
        if (tendrilAlpha > 0.01) {
          ctx.save();
          sparksRef.current.forEach((sp) => {
            sp.x += sp.vx;
            sp.y += sp.vy;
            ctx.beginPath();
            ctx.arc(sp.x, sp.y, sp.radius, 0, Math.PI * 2);
            ctx.fillStyle = sp.color;
            ctx.globalAlpha = sp.alpha * tendrilAlpha;
            ctx.shadowColor = sp.color;
            ctx.shadowBlur = 6;
            ctx.fill();
          });
          ctx.restore();
        }

        // Continue animation or complete
        if (progress < 1.0) {
          animFrameRef.current = requestAnimationFrame(animate);
        } else {
          // Finished animation: ensure DOM is switched and clean up
          document.documentElement.classList.remove('light', 'dark');
          document.documentElement.classList.add(targetTheme);
          document.documentElement.style.removeProperty('--theme-wave-clip');
          if (finishTransitionRef.current) {
            finishTransitionRef.current();
            finishTransitionRef.current = null;
          }
          ctx.clearRect(0, 0, width, height);
          isRunningRef.current = false;
          animFrameRef.current = null;
        }
      };

      animFrameRef.current = requestAnimationFrame(animate);
    },
    [initSeeds]
  );

  useEffect(() => {
    const handleTransitionEvent = (e: CustomEvent<TransitionEventDetail>) => {
      if (e.detail) {
        runTransition(e.detail);
      }
    };

    window.addEventListener(
      'start-theme-transition' as any,
      handleTransitionEvent as any
    );

    return () => {
      window.removeEventListener(
        'start-theme-transition' as any,
        handleTransitionEvent as any
      );
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
      if (finishTransitionRef.current) {
        finishTransitionRef.current();
      }
    };
  }, [runTransition]);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-[999999] select-none"
      style={{
        width: '100vw',
        height: '100vh',
        display: 'block',
      }}
    />
  );
}

export default ThemeTransitionOverlay;
