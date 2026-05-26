'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { detectEnv, type EnvInfo } from '@/lib/engine/environment';
import Icon from '@/components/ui/Icon';

/**
 * EnvBanner — surfaces the measurement context so results are never
 * misinterpreted. On localhost/LAN it shows a prominent warning that the
 * numbers are loopback, not internet. On a deployed origin it shows a subtle,
 * dismissible note explaining why figures may differ from tools like Ookla.
 */
export default function EnvBanner() {
  const [env, setEnv] = useState<EnvInfo | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    setEnv(detectEnv());
  }, []);

  if (!env || dismissed) return null;

  const isWarning = env.isLoopback;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        className={`relative mt-4 rounded-2xl border px-4 py-3 sm:px-5 sm:py-4 ${
          isWarning
            ? 'border-aurora-ember/30 bg-aurora-ember/[0.07]'
            : 'border-aurora-ice/20 bg-aurora-ice/[0.05]'
        }`}
      >
        <div className="flex items-start gap-3">
          <span
            className={`mt-0.5 flex-shrink-0 ${
              isWarning ? 'text-aurora-ember' : 'text-aurora-ice'
            }`}
          >
            <Icon name={isWarning ? 'activity' : 'globe'} size={17} />
          </span>
          <div className="min-w-0 flex-1">
            <p
              className={`text-sm font-medium ${
                isWarning ? 'text-aurora-ember' : 'text-titanium-100'
              }`}
            >
              {isWarning
                ? `Measuring ${env.label.toLowerCase()} — not your internet`
                : 'Live connection'}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-titanium-300">
              {env.note}
            </p>
          </div>
          <button
            onClick={() => setDismissed(true)}
            aria-label="Dismiss"
            className="flex-shrink-0 rounded-full p-1 text-titanium-400 transition-colors hover:text-titanium-100"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
