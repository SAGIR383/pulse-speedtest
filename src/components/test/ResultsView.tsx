'use client';

import { motion } from 'framer-motion';
import type { TestResult, Diagnostics } from '@/lib/engine/types';
import ScoreRing from '@/components/analytics/ScoreRing';
import InsightCard from '@/components/analytics/InsightCard';
import StreamingTiers from '@/components/analytics/StreamingTiers';
import Recommendations from '@/components/analytics/Recommendations';
import AnimatedNumber from './AnimatedNumber';
import Icon from '@/components/ui/Icon';
import { formatMbps } from '@/lib/utils/format';
import PlanComparison from '@/components/analytics/PlanComparison';
import { shareResultCard } from '@/lib/utils/share';

interface ResultsViewProps {
  result: TestResult;
  diagnostics: Diagnostics;
  onRetest: () => void;
}

const scoreColor = (s: number) =>
  s >= 85 ? ['#7affc4', '#5ee7e0'] : s >= 65 ? ['#5ee7e0', '#7cc6ff'] : s >= 40 ? ['#ff9d7a', '#9d8cff'] : ['#ff6b6b', '#ff9d7a'];

export default function ResultsView({ result, diagnostics, onRetest }: ResultsViewProps) {
  const [from, to] = scoreColor(diagnostics.healthScore);

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6">
      {/* Hero: health score + headline */}
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        className="surface-strong rounded-[2rem] p-6 sm:p-10 flex flex-col sm:flex-row items-center gap-8"
      >
        <ScoreRing score={diagnostics.healthScore} size={180} stroke={14} colorFrom={from} colorTo={to}>
          <div className="flex flex-col items-center">
            <AnimatedNumber value={diagnostics.healthScore} decimals={0} className="text-5xl font-display font-light text-titanium-100" />
            <span className="text-[10px] uppercase tracking-[0.2em] text-titanium-400 mt-1">Health</span>
          </div>
        </ScoreRing>
        <div className="flex-1 text-center sm:text-left">
          <motion.h2
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="font-display text-2xl sm:text-3xl font-light text-titanium-100 mb-2"
          >
            {diagnostics.headline}
          </motion.h2>
          <p className="text-titanium-300 text-sm leading-relaxed max-w-xl">{diagnostics.summary}</p>
        </div>
      </motion.div>

      {/* Primary metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { icon: 'download', label: 'Download', value: formatMbps(result.download), unit: 'Mbps', c: '#5ee7e0' },
          { icon: 'upload', label: 'Upload', value: formatMbps(result.upload), unit: 'Mbps', c: '#9d8cff' },
          { icon: 'clock', label: 'Ping', value: result.ping.toFixed(result.ping < 10 ? 1 : 0), unit: 'ms', c: '#7cc6ff' },
          { icon: 'activity', label: 'Jitter', value: result.jitter.toFixed(1), unit: 'ms', c: '#7affc4' },
        ].map((m, i) => (
          <motion.div
            key={m.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 + i * 0.07 }}
            className="surface rounded-3xl p-5"
          >
            <div className="flex items-center gap-2 mb-3" style={{ color: m.c }}>
              <Icon name={m.icon} size={16} />
              <span className="text-[11px] uppercase tracking-wider text-titanium-400">{m.label}</span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-display font-light tabular text-titanium-100">{m.value}</span>
              <span className="text-xs text-titanium-400">{m.unit}</span>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Secondary line */}
      <div className="surface rounded-3xl px-6 py-4 flex flex-wrap items-center justify-between gap-4 text-sm">
        <div className="flex items-center gap-2 text-titanium-300">
          <span className="text-aurora-cyan"><Icon name="globe" size={15} /></span>
          {result.location?.city
            ? `${result.location.city}${result.location.country ? ', ' + result.location.country : ''}`
            : 'Location unavailable'}
          {result.location?.source === 'gps' && <span className="text-[10px] text-aurora-mint">· GPS</span>}
        </div>
        <div className="flex items-center gap-6 text-titanium-300 flex-wrap">
          <span>Packet loss <span className="tabular text-titanium-100">{result.packetLoss}%</span></span>
          <span>Peak ↓ <span className="tabular text-titanium-100">{formatMbps(result.downloadDetail.peak)}</span></span>
          {result.bufferbloat !== undefined && (
            <span>
              Bufferbloat{' '}
              <span
                className="tabular"
                style={{
                  color:
                    result.bufferbloat < 30 ? '#7affc4' : result.bufferbloat < 100 ? '#ff9d7a' : '#ff6b6b',
                }}
              >
                +{result.bufferbloat}ms
              </span>
            </span>
          )}
          {result.connectionType && (
            <span className="hidden sm:inline">{result.connectionType}</span>
          )}
          <span className="hidden sm:inline">{result.isp ?? 'Unknown ISP'}</span>
        </div>
      </div>

      {/* Compare to user's subscribed plan */}
      <PlanComparison result={result} />

      {/* AI insight cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {diagnostics.cards.map((card, i) => (
          <InsightCard key={card.id} card={card} index={i} />
        ))}
      </div>

      {/* Streaming + recommendations */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <StreamingTiers tiers={diagnostics.streaming} />
        <Recommendations items={diagnostics.recommendations} />
      </div>

      {/* Retest + Share CTAs */}
      <div className="flex flex-wrap justify-center gap-3 pt-2">
        <button
          onClick={onRetest}
          className="group relative px-8 py-3.5 rounded-full surface-strong text-titanium-100 font-medium tracking-wide transition-all hover:scale-[1.03] active:scale-95"
        >
          <span className="relative z-10 flex items-center gap-2">
            <Icon name="zap" size={16} />
            Test again
          </span>
        </button>
        <button
          onClick={() => shareResultCard(result, diagnostics.healthScore, diagnostics.headline)}
          className="group relative px-8 py-3.5 rounded-full surface text-titanium-200 font-medium tracking-wide transition-all hover:scale-[1.03] active:scale-95 hover:text-titanium-100"
        >
          <span className="relative z-10 flex items-center gap-2">
            <Icon name="globe" size={16} />
            Share result
          </span>
        </button>
      </div>
    </div>
  );
}
