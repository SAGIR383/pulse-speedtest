'use client';

/**
 * Theme preference (persisted). Pulse is dark by default (its aurora-on-void
 * aesthetic is built for dark); a light theme is offered for daytime/accessible
 * use. We store the choice and apply it via a data-theme attribute on <html>,
 * which CSS variables key off of.
 */

export type Theme = 'dark' | 'light';

const KEY = 'pulse-theme';

export function loadTheme(): Theme {
  if (typeof window === 'undefined') return 'dark';
  try {
    const t = window.localStorage.getItem(KEY);
    if (t === 'light' || t === 'dark') return t;
  } catch {
    /* ignore */
  }
  return 'dark';
}

export function saveTheme(theme: Theme): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(KEY, theme);
  } catch {
    /* ignore */
  }
}

export function applyTheme(theme: Theme): void {
  if (typeof document === 'undefined') return;
  document.documentElement.setAttribute('data-theme', theme);
}
