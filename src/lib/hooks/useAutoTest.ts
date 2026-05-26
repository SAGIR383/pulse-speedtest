'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import {
  loadAutoTest,
  saveAutoTest,
  type AutoTestSettings,
} from '@/lib/settings/autotest';
import { notify } from '@/lib/utils/notify';
import type { TestResult } from '@/lib/engine/types';

/**
 * useAutoTest — monitor mode.
 *
 * Runs the speed test automatically on a fixed interval WHILE the app is open,
 * and (optionally) raises a notification when download drops sharply versus the
 * recent average. It drives the existing test via the `start` function passed
 * in, and watches `result`/`isRunning` from the same hook.
 *
 * Limitation (surfaced in UI): timers are throttled/suspended by browsers when
 * the tab is fully closed, so this monitors only while Pulse is running.
 */
export function useAutoTest(opts: {
  start: () => void;
  isRunning: boolean;
  result: TestResult | null;
  recentDownloads: number[]; // recent history for drop comparison
}) {
  const [settings, setSettings] = useState<AutoTestSettings>(() => loadAutoTest());
  const [nextRunAt, setNextRunAt] = useState<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastResultId = useRef<string | null>(null);

  // Persist settings whenever they change.
  useEffect(() => {
    saveAutoTest(settings);
  }, [settings]);

  const scheduleNext = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (!settings.enabled) {
      setNextRunAt(null);
      return;
    }
    const delay = settings.intervalMin * 60 * 1000;
    setNextRunAt(Date.now() + delay);
    timerRef.current = setTimeout(() => {
      // Only fire if not already mid-test.
      if (!opts.isRunning) opts.start();
    }, delay);
  }, [settings.enabled, settings.intervalMin, opts]);

  // (Re)schedule whenever settings change or a test completes.
  useEffect(() => {
    scheduleNext();
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [scheduleNext]);

  // Watch for a freshly completed result → check for drop, then reschedule.
  useEffect(() => {
    if (!settings.enabled) return;
    const r = opts.result;
    if (!r || r.id === lastResultId.current) return;
    lastResultId.current = r.id;

    if (settings.notifyOnDrop && opts.recentDownloads.length >= 2) {
      const prior = opts.recentDownloads.filter((_, i) => i < opts.recentDownloads.length - 1);
      const avg = prior.reduce((a, b) => a + b, 0) / prior.length;
      if (avg > 0 && r.download < avg * (1 - settings.dropThreshold)) {
        const pct = Math.round((1 - r.download / avg) * 100);
        notify(
          'Pulse: connection drop detected',
          `Download fell ${pct}% to ${r.download.toFixed(1)} Mbps (recent avg ${avg.toFixed(1)} Mbps).`
        );
      }
    }
    // After a completed auto-run, schedule the next one.
    scheduleNext();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opts.result]);

  const update = useCallback((patch: Partial<AutoTestSettings>) => {
    setSettings((s) => ({ ...s, ...patch }));
  }, []);

  return { settings, update, nextRunAt };
}
