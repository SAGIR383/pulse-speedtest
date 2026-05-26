'use client';

import { useEffect, useRef } from 'react';
import type { ThroughputSample } from '@/lib/engine/types';

/**
 * Waveform — a live, smoothed area graph of throughput samples during a phase.
 * Auto-scales to the running peak and draws a soft gradient fill with a
 * bright leading edge. Pure canvas for performance.
 */

interface WaveformProps {
  samples: ThroughputSample[];
  color?: string; // rgb triplet, e.g. "94,231,224"
  height?: number;
}

export default function Waveform({ samples, color = '94,231,224', height = 80 }: WaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const dataRef = useRef<ThroughputSample[]>(samples);

  useEffect(() => {
    dataRef.current = samples;
  }, [samples]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = canvas.clientWidth;
      canvas.width = w * dpr;
      canvas.height = height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const render = () => {
      const data = dataRef.current;
      const w = canvas.clientWidth;
      ctx.clearRect(0, 0, w, height);

      if (data.length >= 2) {
        const peak = Math.max(...data.map((d) => d.mbps), 1) * 1.15;
        const n = data.length;
        const pad = 2;
        const usableH = height - pad * 2;

        const xy = (i: number, v: number): [number, number] => [
          (i / (n - 1)) * w,
          pad + usableH - (v / peak) * usableH,
        ];

        // Build a smoothed path.
        ctx.beginPath();
        ctx.moveTo(0, height);
        ctx.lineTo(...xy(0, data[0].mbps));
        for (let i = 1; i < n; i++) {
          const [x0, y0] = xy(i - 1, data[i - 1].mbps);
          const [x1, y1] = xy(i, data[i].mbps);
          const mx = (x0 + x1) / 2;
          ctx.quadraticCurveTo(x0, y0, mx, (y0 + y1) / 2);
        }
        ctx.lineTo(w, height);
        ctx.closePath();

        const fill = ctx.createLinearGradient(0, 0, 0, height);
        fill.addColorStop(0, `rgba(${color},0.35)`);
        fill.addColorStop(1, `rgba(${color},0.02)`);
        ctx.fillStyle = fill;
        ctx.fill();

        // Stroke line on top.
        ctx.beginPath();
        ctx.moveTo(...xy(0, data[0].mbps));
        for (let i = 1; i < n; i++) {
          const [x0, y0] = xy(i - 1, data[i - 1].mbps);
          const [x1, y1] = xy(i, data[i].mbps);
          const mx = (x0 + x1) / 2;
          ctx.quadraticCurveTo(x0, y0, mx, (y0 + y1) / 2);
        }
        ctx.strokeStyle = `rgba(${color},0.9)`;
        ctx.lineWidth = 1.8;
        ctx.stroke();

        // Leading dot.
        const [lx, ly] = xy(n - 1, data[n - 1].mbps);
        ctx.beginPath();
        ctx.arc(lx, ly, 3, 0, Math.PI * 2);
        ctx.fillStyle = `rgb(${color})`;
        ctx.shadowColor = `rgb(${color})`;
        ctx.shadowBlur = 12;
        ctx.fill();
        ctx.shadowBlur = 0;
      }

      rafRef.current = requestAnimationFrame(render);
    };
    render();

    return () => {
      cancelAnimationFrame(rafRef.current);
      ro.disconnect();
    };
  }, [color, height]);

  return <canvas ref={canvasRef} className="w-full block" style={{ height }} aria-hidden="true" />;
}
