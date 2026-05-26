'use client';

import { motion } from 'framer-motion';

/**
 * ScoreRing — an animated circular progress ring with a gradient stroke.
 * Used for the overall health score and per-card sub-scores.
 */

interface ScoreRingProps {
  score: number; // 0-100
  size?: number;
  stroke?: number;
  label?: string;
  gradientId?: string;
  colorFrom?: string;
  colorTo?: string;
  children?: React.ReactNode;
}

export default function ScoreRing({
  score,
  size = 200,
  stroke = 12,
  gradientId = 'scoreGrad',
  colorFrom = '#5ee7e0',
  colorTo = '#9d8cff',
  children,
}: ScoreRingProps) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - Math.max(0, Math.min(100, score)) / 100);

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={colorFrom} />
            <stop offset="100%" stopColor={colorTo} />
          </linearGradient>
        </defs>
        {/* Track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth={stroke}
        />
        {/* Progress */}
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={`url(#${gradientId})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circ}
          initial={{ strokeDashoffset: circ }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.4, ease: [0.16, 1, 0.3, 1] }}
          style={{ filter: `drop-shadow(0 0 8px ${colorFrom}66)` }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">{children}</div>
    </div>
  );
}
