'use client';

/**
 * Measurement environment detection.
 *
 * Same-origin speed testing can only measure the path between the browser and
 * whatever server is answering the API routes. That has big implications for
 * how results should be interpreted:
 *
 *  - localhost / 127.0.0.1  → the "network" is loopback (RAM-to-RAM). Throughput
 *    will read in the multi-Gbps range and is MEANINGLESS as an internet speed.
 *    We must warn the user loudly.
 *
 *  - a deployed origin (Vercel/Cloudflare/etc.) → results reflect your real
 *    connection's capacity to the nearest CDN edge. This is genuine, but tends
 *    to read higher than tools like Ookla, which deliberately measure against a
 *    reference server inside your ISP's network. Both are "real" — they answer
 *    slightly different questions.
 */

export type MeasurementContext = 'loopback' | 'lan' | 'edge';

export interface EnvInfo {
  context: MeasurementContext;
  /** True when results do NOT represent a real internet measurement. */
  isLoopback: boolean;
  host: string;
  /** Short human label for the UI. */
  label: string;
  /** Longer explanation for a banner/tooltip. */
  note: string;
}

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '0.0.0.0']);

function isPrivateLan(host: string): boolean {
  // RFC1918 ranges + .local mDNS
  if (host.endsWith('.local')) return true;
  if (/^10\./.test(host)) return true;
  if (/^192\.168\./.test(host)) return true;
  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(host)) return true;
  return false;
}

export function detectEnv(): EnvInfo {
  const host =
    typeof window !== 'undefined' ? window.location.hostname : 'unknown';

  if (LOOPBACK_HOSTS.has(host)) {
    return {
      context: 'loopback',
      isLoopback: true,
      host,
      label: 'Loopback (localhost)',
      note:
        'You are running Pulse on localhost, so the test measures your computer talking to itself — not your internet connection. Numbers will be unrealistically high (multiple Gbps). Deploy the app (Vercel/Cloudflare) to measure your real connection.',
    };
  }

  if (isPrivateLan(host)) {
    return {
      context: 'lan',
      isLoopback: true,
      host,
      label: 'Local network',
      note:
        'Pulse is being served from a device on your local network, so results reflect your LAN/Wi-Fi link to that device — not your internet connection to the wider web. Deploy to a public host for real internet measurements.',
    };
  }

  return {
    context: 'edge',
    isLoopback: false,
    host,
    label: 'Live connection',
    note:
      'Results reflect your connection’s real throughput to the nearest server edge. Note: dedicated tools like Ookla measure against a server inside your ISP’s network, so their numbers can differ — both are valid measurements of slightly different paths.',
  };
}
