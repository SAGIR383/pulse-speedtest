'use client';

import { useEffect, useRef } from 'react';
import type { LiveState } from '@/lib/engine/types';

/**
 * FluxOrb — the centerpiece visualization.
 *
 * NOT a speedometer. It's an ambient radial flux field: concentric energy
 * rings that breathe with throughput, a flowing particle stream whose density
 * and velocity track the live metric, and a soft aurora core that shifts hue
 * by phase (latency=ice, download=cyan, upload=violet). Rendered on a single
 * canvas with GPU-friendly compositing.
 */

interface FluxOrbProps {
  live: LiveState;
  /** Normalized 0..1 intensity for the current metric. */
  intensity: number;
  size?: number;
}

interface Particle {
  angle: number;
  radius: number;
  speed: number;
  life: number;
  maxLife: number;
  size: number;
}

const PHASE_HUE: Record<string, [number, number, number]> = {
  latency: [124, 198, 255], // ice
  download: [94, 231, 224], // cyan
  upload: [157, 140, 255], // violet
  analyzing: [122, 255, 196], // mint
  connecting: [139, 148, 173], // titanium
  complete: [122, 255, 196],
  idle: [139, 148, 173],
  error: [255, 107, 107],
};

export default function FluxOrb({ live, intensity, size = 320 }: FluxOrbProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const particlesRef = useRef<Particle[]>([]);
  const stateRef = useRef({ intensity, phase: live.phase });
  const smoothRef = useRef(0);

  // Keep latest values without re-binding the animation loop.
  useEffect(() => {
    stateRef.current = { intensity, phase: live.phase };
  }, [intensity, live.phase]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    ctx.scale(dpr, dpr);

    const cx = size / 2;
    const cy = size / 2;
    const baseR = size * 0.28;

    const spawn = (count: number, intens: number) => {
      for (let i = 0; i < count; i++) {
        particlesRef.current.push({
          angle: Math.random() * Math.PI * 2,
          radius: baseR + Math.random() * 8,
          speed: 0.4 + Math.random() * 1.6 + intens * 2.2,
          life: 0,
          maxLife: 60 + Math.random() * 80,
          size: 0.6 + Math.random() * 1.8,
        });
      }
    };

    let t = 0;
    const render = () => {
      const { intensity: targetI, phase } = stateRef.current;
      // Smooth the intensity so the orb glides rather than snaps.
      smoothRef.current += (targetI - smoothRef.current) * 0.08;
      const I = smoothRef.current;
      const [r, g, b] = PHASE_HUE[phase] ?? PHASE_HUE.idle;

      ctx.clearRect(0, 0, size, size);
      t += 0.016;

      // ---- Aurora core glow ----
      const coreR = baseR * (0.7 + I * 0.5 + Math.sin(t * 1.5) * 0.04);
      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, coreR * 2.4);
      grad.addColorStop(0, `rgba(${r},${g},${b},${0.32 + I * 0.4})`);
      grad.addColorStop(0.4, `rgba(${r},${g},${b},${0.12 + I * 0.15})`);
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, size, size);

      // ---- Concentric breathing rings ----
      const rings = 3;
      for (let i = 0; i < rings; i++) {
        const phaseOff = (t * 0.6 + i * 0.7) % 1;
        const ringR = baseR * (0.6 + phaseOff * (1.3 + I * 0.7));
        const alpha = (1 - phaseOff) * (0.28 + I * 0.35);
        ctx.beginPath();
        ctx.arc(cx, cy, ringR, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(${r},${g},${b},${alpha})`;
        ctx.lineWidth = 1.2 + I * 1.5;
        ctx.stroke();
      }

      // ---- Rotating arc segments (HUD feel) ----
      const segs = 5;
      for (let i = 0; i < segs; i++) {
        const a0 = t * (0.5 + i * 0.12) + (i * Math.PI * 2) / segs;
        const a1 = a0 + 0.5 + I * 0.4;
        const arcR = baseR * 1.35 + i * 4;
        ctx.beginPath();
        ctx.arc(cx, cy, arcR, a0, a1);
        ctx.strokeStyle = `rgba(${r},${g},${b},${0.15 + I * 0.25})`;
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.stroke();
      }

      // ---- Flowing particle stream ----
      const isActive = ['download', 'upload', 'latency', 'analyzing'].includes(phase);
      if (isActive) spawn(Math.round(1 + I * 4), I);

      particlesRef.current = particlesRef.current.filter((p) => {
        p.life++;
        if (p.life > p.maxLife) return false;
        // Particles drift outward for download, inward for upload.
        const dir = phase === 'upload' ? -1 : 1;
        p.radius += p.speed * dir;
        p.angle += 0.01 * dir;
        const lifeT = p.life / p.maxLife;
        const alpha = Math.sin(lifeT * Math.PI) * (0.5 + I * 0.5);
        const px = cx + Math.cos(p.angle) * p.radius;
        const py = cy + Math.sin(p.angle) * p.radius;
        ctx.beginPath();
        ctx.arc(px, py, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${r},${g},${b},${alpha})`;
        ctx.fill();
        return p.radius < size * 0.7 && p.radius > baseR * 0.4;
      });

      // ---- Inner solid core ----
      const innerGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, coreR);
      innerGrad.addColorStop(0, `rgba(${r},${g},${b},${0.22 + I * 0.25})`);
      innerGrad.addColorStop(1, 'rgba(5,6,10,0)');
      ctx.fillStyle = innerGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, coreR, 0, Math.PI * 2);
      ctx.fill();

      rafRef.current = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(rafRef.current);
  }, [size]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: size, height: size }}
      className="block"
      aria-hidden="true"
    />
  );
}
