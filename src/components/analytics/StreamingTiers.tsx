'use client';

import { motion } from 'framer-motion';
import type { StreamingTier } from '@/lib/engine/types';

export default function StreamingTiers({ tiers }: { tiers: StreamingTier[] }) {
  return (
    <div className="surface rounded-3xl p-6">
      <div className="flex items-center justify-between mb-5">
        <h3 className="font-display text-base tracking-wide text-titanium-100">Streaming capability</h3>
        <span className="text-xs text-titanium-300">Max resolution per device</span>
      </div>
      <div className="space-y-3">
        {tiers.map((tier, i) => (
          <motion.div
            key={tier.label}
            initial={{ opacity: 0, x: -16 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.06, duration: 0.5 }}
            className="flex items-center gap-4"
          >
            <div className="w-16 shrink-0">
              <div className="text-sm font-medium text-titanium-100">{tier.resolution}</div>
              <div className="text-[10px] text-titanium-400 uppercase tracking-wider">{tier.label}</div>
            </div>
            <div className="flex-1 h-2 rounded-full bg-white/5 overflow-hidden">
              <motion.div
                className="h-full rounded-full"
                style={{
                  background: tier.supported
                    ? 'linear-gradient(90deg,#5ee7e0,#7affc4)'
                    : 'linear-gradient(90deg,#5f6781,#3f465c)',
                }}
                initial={{ width: 0 }}
                whileInView={{ width: `${Math.min(100, (tier.margin / 3) * 100)}%` }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.06 + 0.2, duration: 0.8, ease: 'easeOut' }}
              />
            </div>
            <div className="w-20 shrink-0 text-right">
              {tier.supported ? (
                <span className="text-aurora-mint text-xs font-medium">✓ {tier.margin}×</span>
              ) : (
                <span className="text-titanium-400 text-xs">needs {tier.requiredMbps}</span>
              )}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
