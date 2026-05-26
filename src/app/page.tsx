'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { AnimatePresence, motion } from 'framer-motion';
import { useSpeedTest } from '@/lib/hooks/useSpeedTest';
import { getResults, clearResults } from '@/lib/db/history';
import type { TestResult } from '@/lib/engine/types';
import Header from '@/components/layout/Header';
import InstallPrompt from '@/components/layout/InstallPrompt';
import EnvBanner from '@/components/layout/EnvBanner';
import TestStage from '@/components/test/TestStage';
import ResultsView from '@/components/test/ResultsView';
import HistoryDashboard from '@/components/analytics/HistoryDashboard';
import Icon from '@/components/ui/Icon';

// Map is client-only and lazy — keep Leaflet off the critical path.
const NetworkMap = dynamic(() => import('@/components/map/NetworkMap'), {
  ssr: false,
  loading: () => <div className="w-full rounded-3xl surface shimmer" style={{ minHeight: 280 }} />,
});

export default function Page() {
  const {
    live, result, diagnostics, location, isp, nodes,
    isRunning, error, start, reset, requestPreciseLocation,
  } = useSpeedTest();

  const [view, setView] = useState<'test' | 'history'>('test');
  const [history, setHistory] = useState<TestResult[]>([]);

  // Load history whenever we switch to it or finish a test.
  useEffect(() => {
    if (view === 'history' || result) {
      getResults().then(setHistory);
    }
  }, [view, result]);

  const handleClear = async () => {
    await clearResults();
    setHistory([]);
  };

  const showIdle = !isRunning && !result && live.phase !== 'analyzing';

  return (
    <main className="min-h-screen flex flex-col">
      <Header view={view} setView={setView} location={location} isp={isp} />

      <div className="flex-1 w-full max-w-5xl mx-auto px-5 sm:px-6 pb-24">
        <AnimatePresence mode="wait">
          {view === 'history' ? (
            <motion.div
              key="history"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              className="pt-4"
            >
              <h2 className="font-display text-xl font-light text-titanium-100 mb-5">Your network over time</h2>
              <HistoryDashboard results={history} onClear={handleClear} />
            </motion.div>
          ) : (
            <motion.div
              key="test"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="pt-4"
            >
              <EnvBanner />

              {/* Idle / hero state */}
              {showIdle && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex flex-col items-center text-center pt-6 sm:pt-12"
                >
                  <motion.h1
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                    className="font-display text-4xl sm:text-6xl font-light tracking-tight text-titanium-100 max-w-2xl leading-[1.05]"
                  >
                    Understand your
                    <span className="block bg-gradient-to-r from-aurora-cyan via-aurora-ice to-aurora-violet bg-clip-text text-transparent glow-cyan">
                      internet, intelligently
                    </span>
                  </motion.h1>
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.3 }}
                    className="text-titanium-300 text-sm sm:text-base mt-5 max-w-md"
                  >
                    Real measurements. Cinematic clarity. Pulse runs a precise browser-based
                    test, then translates the numbers into answers you actually care about.
                  </motion.p>

                  <motion.button
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.45, type: 'spring', stiffness: 200 }}
                    onClick={start}
                    className="group relative mt-10 h-44 w-44 rounded-full flex items-center justify-center"
                  >
                    <span className="absolute inset-0 rounded-full bg-gradient-to-br from-aurora-cyan/30 to-aurora-violet/30 blur-xl group-hover:blur-2xl transition-all animate-pulse-soft" />
                    <span className="absolute inset-0 rounded-full surface-strong" />
                    <span className="absolute inset-2 rounded-full border border-white/10" />
                    <span className="relative z-10 flex flex-col items-center">
                      <span className="text-aurora-cyan mb-1"><Icon name="zap" size={28} /></span>
                      <span className="font-display text-lg font-light tracking-wide text-titanium-100">Start test</span>
                    </span>
                  </motion.button>

                  {/* Map preview */}
                  <div className="w-full mt-14">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-display text-sm tracking-wide text-titanium-100 flex items-center gap-2">
                        <span className="text-aurora-cyan"><Icon name="globe" size={15} /></span>
                        Your network region
                      </h3>
                      {location?.source !== 'gps' && (
                        <button
                          onClick={requestPreciseLocation}
                          className="text-xs text-aurora-cyan hover:text-aurora-ice transition-colors"
                        >
                          Use precise location
                        </button>
                      )}
                    </div>
                    <NetworkMap location={location} nodes={nodes} className="h-72" />
                  </div>
                </motion.div>
              )}

              {/* Live testing state */}
              {(isRunning || live.phase === 'analyzing') && (
                <div className="flex flex-col items-center pt-6 sm:pt-12">
                  <TestStage live={live} />
                </div>
              )}

              {/* Results */}
              {result && diagnostics && !isRunning && (
                <ResultsView result={result} diagnostics={diagnostics} onRetest={reset} />
              )}

              {/* Error */}
              {error && !isRunning && (
                <div className="surface rounded-3xl p-8 text-center mt-8">
                  <p className="text-aurora-ember mb-3">Test couldn’t complete</p>
                  <p className="text-titanium-300 text-sm mb-5">{error}</p>
                  <button onClick={reset} className="px-6 py-2.5 rounded-full surface-strong text-titanium-100 text-sm">
                    Try again
                  </button>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <InstallPrompt />

      <footer className="w-full max-w-5xl mx-auto px-6 py-6 text-center text-[11px] text-titanium-400">
        Pulse measures real throughput between your browser and the server answering it.
        On localhost that path is your own machine — deploy to measure your real connection.
        Results are stored locally on your device.
      </footer>
    </main>
  );
}
