'use client';

import { motion } from 'framer-motion';

/**
 * Offline shell. Served by the service worker when a navigation request
 * fails and no cached version of the destination exists. Kept intentionally
 * dependency-free and lightweight so it renders instantly from cache.
 */
export default function OfflinePage() {
  return (
    <main className="relative flex min-h-[100dvh] flex-col items-center justify-center overflow-hidden px-6 text-center">
      {/* ambient pulse */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <motion.div
          className="h-[460px] w-[460px] rounded-full"
          style={{
            background:
              'radial-gradient(circle, rgba(94,231,224,0.12), rgba(157,140,255,0.05) 45%, transparent 70%)',
          }}
          animate={{ scale: [1, 1.08, 1], opacity: [0.6, 0.9, 0.6] }}
          transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
        />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="relative z-10 flex flex-col items-center"
      >
        <div className="surface mb-8 flex h-20 w-20 items-center justify-center rounded-2xl">
          <svg
            width="36"
            height="36"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-aurora-cyan"
          >
            <path d="M2 8.82a15 15 0 0 1 20 0" opacity="0.4" />
            <path d="M5 12.859a10 10 0 0 1 14 0" opacity="0.7" />
            <path d="M8.5 16.429a5 5 0 0 1 7 0" />
            <line x1="12" y1="20" x2="12.01" y2="20" />
            <line x1="2" y1="2" x2="22" y2="22" opacity="0.5" />
          </svg>
        </div>

        <h1 className="font-display text-3xl font-semibold tracking-tight text-titanium-50 sm:text-4xl">
          You&apos;re offline
        </h1>
        <p className="mt-4 max-w-sm text-pretty text-titanium-300">
          Pulse needs a live connection to measure your network. The app shell
          is cached and ready &mdash; reconnect and we&apos;ll pick up right
          where you left off.
        </p>

        <button
          onClick={() => window.location.reload()}
          className="surface-strong glow-cyan mt-8 rounded-full px-7 py-3 text-sm font-medium text-titanium-50 transition-transform active:scale-95"
        >
          Try again
        </button>

        <p className="mt-6 font-mono text-xs uppercase tracking-[0.2em] text-titanium-500">
          Network Intelligence
        </p>
      </motion.div>
    </main>
  );
}
