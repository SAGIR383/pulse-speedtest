'use client';

import { motion } from 'framer-motion';
import type { InsightCard as InsightCardType } from '@/lib/engine/types';
import Icon from '@/components/ui/Icon';
import ScoreRing from './ScoreRing';

const verdictMeta: Record<string, { label: string; from: string; to: string; dot: string }> = {
  excellent: { label: 'Excellent', from: '#7affc4', to: '#5ee7e0', dot: '#7affc4' },
  good: { label: 'Good', from: '#5ee7e0', to: '#7cc6ff', dot: '#5ee7e0' },
  fair: { label: 'Fair', from: '#ff9d7a', to: '#9d8cff', dot: '#ff9d7a' },
  poor: { label: 'Poor', from: '#ff6b6b', to: '#ff9d7a', dot: '#ff6b6b' },
};

export default function InsightCard({ card, index }: { card: InsightCardType; index: number }) {
  const meta = verdictMeta[card.verdict];
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: 0.6, delay: index * 0.08, ease: [0.16, 1, 0.3, 1] }}
      className="surface rounded-3xl p-5 sm:p-6 flex gap-5 items-center"
    >
      <div className="shrink-0">
        <ScoreRing
          score={card.score}
          size={84}
          stroke={6}
          gradientId={`grad-${card.id}`}
          colorFrom={meta.from}
          colorTo={meta.to}
        >
          <div style={{ color: meta.from }}>
            <Icon name={card.icon} size={26} />
          </div>
        </ScoreRing>
      </div>
      <div className="min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <h3 className="text-titanium-100 font-display text-base tracking-wide">{card.title}</h3>
          <span
            className="text-[10px] uppercase tracking-widest px-2 py-0.5 rounded-full"
            style={{ color: meta.dot, background: `${meta.dot}1a` }}
          >
            {meta.label}
          </span>
        </div>
        <p className="text-titanium-100 text-sm font-medium">{card.summary}</p>
        {card.detail && <p className="text-titanium-300 text-xs mt-1 leading-relaxed">{card.detail}</p>}
      </div>
    </motion.div>
  );
}
