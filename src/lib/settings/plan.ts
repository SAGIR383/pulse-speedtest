'use client';

/**
 * User plan settings (persisted in localStorage).
 *
 * Lets the user record the speeds they're paying their ISP for, so results can
 * show what percentage of the plan they're actually getting — the real-world
 * question behind every speed test.
 */

export interface PlanSettings {
  /** Advertised download speed in Mbps (0 = not set). */
  planDownload: number;
  /** Advertised upload speed in Mbps (0 = not set). */
  planUpload: number;
  /** Optional label, e.g. "Jio Fiber 100". */
  planLabel: string;
}

const KEY = 'pulse-plan-settings';

const EMPTY: PlanSettings = { planDownload: 0, planUpload: 0, planLabel: '' };

export function loadPlan(): PlanSettings {
  if (typeof window === 'undefined') return EMPTY;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw);
    return {
      planDownload: Number(parsed.planDownload) || 0,
      planUpload: Number(parsed.planUpload) || 0,
      planLabel: typeof parsed.planLabel === 'string' ? parsed.planLabel : '',
    };
  } catch {
    return EMPTY;
  }
}

export function savePlan(plan: PlanSettings): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(plan));
  } catch {
    /* storage unavailable (private mode etc.) — ignore */
  }
}

export function hasPlan(plan: PlanSettings): boolean {
  return plan.planDownload > 0 || plan.planUpload > 0;
}

/** Percentage of plan achieved, capped at 100 for display sanity. */
export function planPercent(actual: number, plan: number): number | null {
  if (!plan || plan <= 0) return null;
  return Math.round((actual / plan) * 100);
}
