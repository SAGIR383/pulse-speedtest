import type { LatencyResult } from './types';

/**
 * Latency engine.
 *
 * Measures real round-trip time by issuing many tiny same-origin requests
 * and timing them with performance.now(). We use the Resource Timing API
 * when available to isolate network time from JS overhead, falling back to
 * wall-clock timing otherwise.
 *
 * Jitter is computed as the mean absolute difference between consecutive
 * RTT samples (RFC 3550-style inter-arrival jitter approximation).
 *
 * Packet loss is estimated from request failures / timeouts across the
 * sample set. Browsers cannot send raw ICMP, so this is an HTTP-level
 * approximation — but it reliably catches a genuinely lossy link.
 */

export interface LatencyOptions {
  endpoint: string;
  /** Number of RTT probes. */
  samples?: number;
  /** Per-probe timeout in ms — beyond this we count it as a loss. */
  timeoutMs?: number;
  /** Called on every completed probe for live visualization. */
  onSample?: (rtt: number, index: number, total: number) => void;
  signal?: AbortSignal;
}

const median = (arr: number[]): number => {
  if (arr.length === 0) return 0;
  const s = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
};

async function probeOnce(
  endpoint: string,
  timeoutMs: number,
  signal?: AbortSignal,
): Promise<number | null> {
  const ctrl = new AbortController();
  const onAbort = () => ctrl.abort();
  signal?.addEventListener('abort', onAbort, { once: true });
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);

  // Cache-bust each probe so we measure the network, not the disk cache.
  const url = `${endpoint}?t=${performance.now()}_${Math.random()}`;
  const start = performance.now();
  try {
    // HEAD keeps the payload tiny; the server replies with a 1-byte 204/200.
    await fetch(url, {
      method: 'GET',
      cache: 'no-store',
      signal: ctrl.signal,
      headers: { 'x-pulse-probe': '1' },
    });
    const end = performance.now();

    // Prefer Resource Timing for network-only duration when exposed.
    let rtt = end - start;
    try {
      const entries = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
      const match = entries.reverse().find((e) => e.name.includes(endpoint.split('?')[0]) && url.includes(e.name.split('?')[0]));
      if (match && match.responseStart > 0 && match.requestStart > 0) {
        rtt = match.responseStart - match.requestStart;
      }
    } catch {
      /* Resource timing not available — keep wall-clock value. */
    }
    return rtt;
  } catch {
    return null; // timeout or network failure -> potential packet loss
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onAbort);
  }
}

export async function measureLatency(opts: LatencyOptions): Promise<LatencyResult> {
  const samples = opts.samples ?? 24;
  const timeoutMs = opts.timeoutMs ?? 4000;
  const rtts: number[] = [];
  let lost = 0;

  // Warm-up probe to open the connection (TCP/TLS handshake excluded from stats).
  await probeOnce(opts.endpoint, timeoutMs, opts.signal);

  for (let i = 0; i < samples; i++) {
    if (opts.signal?.aborted) break;
    const rtt = await probeOnce(opts.endpoint, timeoutMs, opts.signal);
    if (rtt === null) {
      lost++;
    } else {
      rtts.push(rtt);
      opts.onSample?.(rtt, i, samples);
    }
    // Small spacing so probes don't queue behind each other on HTTP/1.1.
    await new Promise((r) => setTimeout(r, 12));
  }

  if (rtts.length === 0) {
    return { ping: 0, jitter: 0, min: 0, max: 0, samples: [], packetLoss: 100 };
  }

  // Discard the single worst outlier to avoid GC/scheduler spikes skewing ping.
  const trimmed = [...rtts].sort((a, b) => a - b);
  if (trimmed.length > 6) trimmed.pop();

  const ping = median(trimmed);

  // Inter-arrival jitter: mean absolute consecutive difference.
  let jitterAcc = 0;
  for (let i = 1; i < rtts.length; i++) {
    jitterAcc += Math.abs(rtts[i] - rtts[i - 1]);
  }
  const jitter = rtts.length > 1 ? jitterAcc / (rtts.length - 1) : 0;

  const packetLoss = (lost / samples) * 100;

  return {
    ping: Math.round(ping * 10) / 10,
    jitter: Math.round(jitter * 10) / 10,
    min: Math.round(Math.min(...rtts) * 10) / 10,
    max: Math.round(Math.max(...rtts) * 10) / 10,
    samples: rtts,
    packetLoss: Math.round(packetLoss * 10) / 10,
  };
}
