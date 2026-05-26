'use client';

import { AnimatePresence, motion } from 'framer-motion';
import type { LiveState } from '@/lib/engine/types';
import FluxOrb from './FluxOrb';
import Waveform from './Waveform';
import AnimatedNumber from './AnimatedNumber';
import Icon from '@/components/ui/Icon';

/**
 * TestStage — the cinematic live testing view. Shows the FluxOrb, the active
 * metric being measured, a live waveform, and the four running stats.
 */

const PHASE_LABEL: Record<string, string> = {
  idle: 'Ready',
  connecting: 'Establishing connection',
  latency: 'Measuring latency',
  download: 'Measuring download',
  upload: 'Measuring upload',
  analyzing: 'Analyzing your network',
  complete: 'Complete',
  error: 'Something went wrong',
};

const PHASE_COLOR: Record<string, string> = {
  latency: '124,198,255',
  download: '94,231,224',
  upload: '157,140,255',
  analyzing: '122,255,196',
  connecting: '139,148,173',
  idle: '139,148,173',
  complete: '122,255,196',
  error: '255,107,107',
};

function intensityFor(live: LiveState): number {
  if (live.phase === 'latency') {
    // Lower ping = higher intensity, inverted & clamped.
    return Math.max(0.15, Math.min(1, 1 - live.current / 200));
  }
  if (live.phase === 'download' || live.phase === 'upload') {
    // Log-scale throughput so both slow and fast links animate nicely.
    return Math.max(0.1, Math.min(1, Math.log10(live.current + 1) / Math.log10(500)));
  }
  if (live.phase === 'analyzing' || live.phase === 'connecting') return 0.5;
  return 0.2;
}

export default function TestStage({ live }: { live: LiveState }) {
  const color = PHASE_COLOR[live.phase] ?? PHASE_COLOR.idle;
  const isThroughput = live.phase === 'download' || live.phase === 'upload';
  const isLatency = live.phase === 'latency';
  const unit = isThroughput ? 'Mbps' : isLatency ? 'ms' : '';

  return (
    <div className="flex flex-col items-center w-full">
      {/* Orb + central metric */}
      <div className="relative flex items-center justify-center" style={{ width: 320, height: 320 }}>
        <FluxOrb live={live} intensity={intensityFor(live)} size={320} />
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <AnimatePresence mode="wait">
            <motion.div
              key={live.phase}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.4 }}
              className="text-[11px] uppercase tracking-[0.25em] mb-2"
              style={{ color: `rgb(${color})` }}
            >
              {PHASE_LABEL[live.phase]}
            </motion.div>
          </AnimatePresence>
          <div className="flex items-baseline gap-2">
            <AnimatedNumber
              value={isThroughput ? live.current : isLatency ? live.current : 0}
              decimals={isThroughput ? (live.current >= 100 ? 0 : 1) : 0}
              className="text-6xl font-display font-light text-titanium-100"
            />
            {unit && <span className="text-titanium-300 text-lg font-light">{unit}</span>}
          </div>
          {(isThroughput || isLatency) && (
            <div className="mt-3 w-40 h-0.5 rounded-full bg-white/10 overflow-hidden">
              <motion.div
                className="h-full rounded-full"
                style={{ background: `rgb(${color})` }}
                animate={{ width: `${live.progress * 100}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>
          )}
        </div>
      </div>

      {/* Live waveform for throughput phases */}
      <div className="w-full max-w-md mt-6 h-20">
        {isThroughput && live.samples.length > 1 && (
          <Waveform samples={live.samples} color={color} height={80} />
        )}
      </div>

      {/* Running stats row */}
      <div className="grid grid-cols-4 gap-2 sm:gap-4 w-full max-w-md mt-2">
        {[
          { icon: 'download', label: 'Down', value: live.download, unit: 'Mbps', c: 'text-aurora-cyan' },
          { icon: 'upload', label: 'Up', value: live.upload, unit: 'Mbps', c: 'text-aurora-violet' },
          { icon: 'clock', label: 'Ping', value: live.ping, unit: 'ms', c: 'text-aurora-ice' },
          { icon: 'activity', label: 'Jitter', value: live.jitter, unit: 'ms', c: 'text-aurora-mint' },
        ].map((s) => (
          <div key={s.label} className="surface rounded-2xl px-2 py-3 flex flex-col items-center">
            <span className={`${s.c} mb-1`}>
              <Icon name={s.icon} size={15} />
            </span>
            <span className="tabular text-titanium-100 text-sm font-medium">
              {s.value > 0 ? (s.value >= 100 ? s.value.toFixed(0) : s.value.toFixed(s.unit === 'ms' ? 0 : 1)) : '—'}
            </span>
            <span className="text-[9px] text-titanium-400 uppercase tracking-wider">{s.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
