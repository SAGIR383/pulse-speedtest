import type { LatencyResult } from './types';

/**
 * Cloudflare-backed latency / jitter / packet-loss measurement.
 *
 * Sends many tiny GET requests to Cloudflare's __down endpoint (1 byte each)
 * and times the round trip with performance.now(). Measures the browser's RTT
 * to Cloudflare's nearest node — the real network path, not our app origin.
 */

const CF_DOWN = 'https://speed.cloudflare.com/__down';

export interface CfLatencyOptions {
  samples?: number;
  signal?: AbortSignal;
  onSample?: (rtt: number, index: number, total: number) => void;
}

export async function measureLatencyCf(
  opts: CfLatencyOptions = {}
): Promise<LatencyResult> {
  const total = opts.samples ?? 24;
  const rtts: number[] = [];
  let failures = 0;

  // Warm-up probe (establish TLS/connection; not counted).
  try {
    await fetch(`${CF_DOWN}?bytes=1&t=${performance.now()}`, {
      cache: 'no-store',
      signal: opts.signal,
    });
  } catch {
    /* ignore */
  }

  for (let i = 0; i < total; i++) {
    if (opts.signal?.aborted) break;
    const t0 = performance.now();
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 3000);
      const signal = opts.signal
        ? anySignal([opts.signal, ctrl.signal])
        : ctrl.signal;
      await fetch(`${CF_DOWN}?bytes=1&t=${performance.now()}_${i}`, {
        cache: 'no-store',
        signal,
      });
      clearTimeout(timer);
      const rtt = performance.now() - t0;
      rtts.push(rtt);
      opts.onSample?.(rtt, i, total);
    } catch {
      failures++;
    }
    await new Promise((r) => setTimeout(r, 40));
  }

  return finishLatency(rtts, failures, total);
}

function anySignal(signals: AbortSignal[]): AbortSignal {
  const ctrl = new AbortController();
  for (const s of signals) {
    if (s.aborted) {
      ctrl.abort();
      break;
    }
    s.addEventListener('abort', () => ctrl.abort(), { once: true });
  }
  return ctrl.signal;
}

function finishLatency(
  rtts: number[],
  failures: number,
  total: number
): LatencyResult {
  if (rtts.length === 0) {
    return { ping: 0, jitter: 0, min: 0, max: 0, packetLoss: 100, samples: [] };
  }
  const sorted = [...rtts].sort((a, b) => a - b);
  const trim = Math.floor(sorted.length * 0.1);
  const core = sorted.slice(trim, sorted.length - trim || sorted.length);
  const median = core[Math.floor(core.length / 2)];

  let jitterSum = 0;
  for (let i = 1; i < rtts.length; i++) {
    jitterSum += Math.abs(rtts[i] - rtts[i - 1]);
  }
  const jitter = jitterSum / Math.max(rtts.length - 1, 1);

  return {
    ping: Math.round(median * 10) / 10,
    jitter: Math.round(jitter * 10) / 10,
    min: Math.round(sorted[0] * 10) / 10,
    max: Math.round(sorted[sorted.length - 1] * 10) / 10,
    packetLoss: Math.round((failures / total) * 1000) / 10,
    samples: rtts,
  };
}
