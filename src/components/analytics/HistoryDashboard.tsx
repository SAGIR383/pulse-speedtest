'use client';

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import type { TestResult } from '@/lib/engine/types';
import { relativeTime, formatMbps } from '@/lib/utils/format';

/**
 * HistoryDashboard — renders speed history from IndexedDB as a sparkline trend
 * plus a summary table. Custom SVG charting, no external dependency.
 */

function Sparkline({ values, color, height = 48 }: { values: number[]; color: string; height?: number }) {
  if (values.length < 2) {
    return <div className="text-xs text-titanium-400 py-4">Not enough data yet — run a few tests.</div>;
  }
  const w = 100;
  const max = Math.max(...values) * 1.1 || 1;
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * w;
    const y = height - (v / max) * height;
    return `${x},${y}`;
  });
  const area = `0,${height} ${pts.join(' ')} ${w},${height}`;
  return (
    <svg viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="none" className="w-full" style={{ height }}>
      <defs>
        <linearGradient id={`spark-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={area} fill={`url(#spark-${color.replace('#', '')})`} />
      <polyline points={pts.join(' ')} fill="none" stroke={color} strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export default function HistoryDashboard({ results, onClear }: { results: TestResult[]; onClear: () => void }) {
  const ordered = useMemo(() => [...results].reverse(), [results]);
  const dl = ordered.map((r) => r.download);
  const ul = ordered.map((r) => r.upload);
  const ping = ordered.map((r) => r.ping);

  const avg = (arr: number[]) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0);

  if (results.length === 0) {
    return (
      <div className="surface rounded-3xl p-10 text-center">
        <p className="text-titanium-300 text-sm">No test history yet. Your results will appear here and sync to this device only.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: 'Avg Download', value: formatMbps(avg(dl)), unit: 'Mbps', vals: dl, color: '#5ee7e0' },
          { label: 'Avg Upload', value: formatMbps(avg(ul)), unit: 'Mbps', vals: ul, color: '#9d8cff' },
          { label: 'Avg Ping', value: avg(ping).toFixed(0), unit: 'ms', vals: ping.map((p) => -p + Math.max(...ping, 1)), color: '#7cc6ff' },
        ].map((m, i) => (
          <motion.div
            key={m.label}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08 }}
            className="surface rounded-3xl p-5"
          >
            <div className="text-xs text-titanium-400 uppercase tracking-wider mb-1">{m.label}</div>
            <div className="flex items-baseline gap-1 mb-2">
              <span className="text-2xl font-display tabular text-titanium-100">{m.value}</span>
              <span className="text-xs text-titanium-400">{m.unit}</span>
            </div>
            <Sparkline values={m.vals} color={m.color} />
          </motion.div>
        ))}
      </div>

      <div className="surface rounded-3xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
          <h3 className="font-display text-sm tracking-wide text-titanium-100">Recent tests · {results.length}</h3>
          <button
            onClick={onClear}
            className="text-xs text-titanium-400 hover:text-aurora-ember transition-colors"
          >
            Clear history
          </button>
        </div>
        <div className="divide-y divide-white/5 max-h-80 overflow-y-auto">
          {results.map((r) => (
            <div key={r.id} className="px-6 py-3 flex items-center justify-between text-sm">
              <div className="flex flex-col">
                <span className="text-titanium-300 text-xs">{relativeTime(r.timestamp)}</span>
                <span className="text-titanium-400 text-[11px]">{r.isp ?? 'Unknown ISP'}</span>
              </div>
              <div className="flex items-center gap-4 tabular">
                <span className="text-aurora-cyan">{formatMbps(r.download)}<span className="text-titanium-400 text-[10px] ml-0.5">↓</span></span>
                <span className="text-aurora-violet">{formatMbps(r.upload)}<span className="text-titanium-400 text-[10px] ml-0.5">↑</span></span>
                <span className="text-aurora-ice">{r.ping.toFixed(0)}<span className="text-titanium-400 text-[10px] ml-0.5">ms</span></span>
                <span className="text-titanium-100 w-8 text-right">{r.healthScore}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
