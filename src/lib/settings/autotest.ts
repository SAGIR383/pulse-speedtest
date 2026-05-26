'use client';

/**
 * Auto-test / monitor-mode settings (persisted in localStorage).
 *
 * IMPORTANT honest limitation: a website can only run scheduled tests while a
 * tab is open and the page is alive. Browsers intentionally suspend timers in
 * fully-closed tabs (battery/privacy). So "monitor mode" runs while Pulse is
 * open (great for leaving it running on a desktop tab); it cannot test when the
 * app is entirely closed. The UI states this plainly.
 */

export interface AutoTestSettings {
  enabled: boolean;
  /** Interval between automatic tests, in minutes. */
  intervalMin: number;
  /** Notify if a metric drops sharply vs the recent average. */
  notifyOnDrop: boolean;
  /** Drop threshold as a fraction (0.4 = alert if download falls >40%). */
  dropThreshold: number;
}

const KEY = 'pulse-autotest-settings';

const DEFAULTS: AutoTestSettings = {
  enabled: false,
  intervalMin: 15,
  notifyOnDrop: true,
  dropThreshold: 0.4,
};

export const INTERVAL_OPTIONS = [5, 10, 15, 30, 60];

export function loadAutoTest(): AutoTestSettings {
  if (typeof window === 'undefined') return DEFAULTS;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return DEFAULTS;
    const p = JSON.parse(raw);
    return {
      enabled: Boolean(p.enabled),
      intervalMin: INTERVAL_OPTIONS.includes(p.intervalMin) ? p.intervalMin : 15,
      notifyOnDrop: p.notifyOnDrop !== false,
      dropThreshold: typeof p.dropThreshold === 'number' ? p.dropThreshold : 0.4,
    };
  } catch {
    return DEFAULTS;
  }
}

export function saveAutoTest(s: AutoTestSettings): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}
