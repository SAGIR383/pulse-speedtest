import type { ThroughputResult, ThroughputSample } from './types';

/**
 * Cloudflare-backed download measurement.
 *
 * Unlike the same-origin engine (which measures the path to our own CDN edge),
 * this measures the browser's path to Cloudflare's globally-distributed speed
 * test backend — the same infrastructure that powers speed.cloudflare.com.
 * Because Cloudflare has nodes inside/near most ISP networks (including India),
 * this reflects real internet throughput far more closely than an app-origin
 * test, landing much nearer to tools like Ookla.
 *
 * Endpoint: https://speed.cloudflare.com/__down?bytes=N
 * These endpoints send permissive CORS headers, so the browser can call them
 * directly — which is essential: the measurement must traverse the user's real
 * connection, not be proxied through our server.
 */

const BITS_PER_BYTE = 8;
const MB = 1_000_000;
const CF_DOWN = 'https://speed.cloudflare.com/__down';

export interface CfDownloadOptions {
  durationMs?: number;
  warmupMs?: number;
  /** Bytes per request. Cloudflare caps very large values; 25 MB is a good unit. */
  chunkBytes?: number;
  streams?: number;
  signal?: AbortSignal;
  onSample?: (mbps: number, sample: ThroughputSample) => void;
}

export async function measureDownloadCf(
  opts: CfDownloadOptions = {}
): Promise<ThroughputResult> {
  const durationMs = opts.durationMs ?? 10_000;
  const warmupMs = opts.warmupMs ?? 2000;
  const chunkBytes = opts.chunkBytes ?? 25 * 1024 * 1024; // 25 MB per request
  const streams = opts.streams ?? 6;

  let totalBytes = 0;
  let active = true;
  const samples: ThroughputSample[] = [];
  const phaseStart = performance.now();

  const runStream = async (): Promise<void> => {
    while (active && !opts.signal?.aborted) {
      // Cache-bust so every request is a fresh transfer over the wire.
      const url = `${CF_DOWN}?bytes=${chunkBytes}&t=${performance.now()}_${Math.random()}`;
      try {
        const res = await fetch(url, {
          cache: 'no-store',
          signal: opts.signal,
          // Cloudflare's endpoint is CORS-enabled; default mode is fine.
        });
        if (!res.body) {
          const buf = await res.arrayBuffer();
          totalBytes += buf.byteLength;
          continue;
        }
        const reader = res.body.getReader();
        // eslint-disable-next-line no-constant-condition
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (value) totalBytes += value.byteLength;
          if (!active || opts.signal?.aborted) {
            try { await reader.cancel(); } catch { /* noop */ }
            break;
          }
        }
      } catch {
        if (!active) return;
        await new Promise((r) => setTimeout(r, 40));
      }
    }
  };

  let lastBytes = 0;
  let lastT = phaseStart;
  let peak = 0;
  let warmupBytes = -1;
  let warmupTime = 0;
  const sampler = setInterval(() => {
    const now = performance.now();
    const elapsed = now - phaseStart;
    const dt = (now - lastT) / 1000;
    if (dt <= 0) return;
    const deltaBytes = totalBytes - lastBytes;
    const mbps = (deltaBytes * BITS_PER_BYTE) / dt / MB;
    lastBytes = totalBytes;
    lastT = now;
    if (warmupBytes < 0 && elapsed >= warmupMs) {
      warmupBytes = totalBytes;
      warmupTime = now;
    }
    const sample: ThroughputSample = { t: elapsed, mbps: Math.max(0, mbps) };
    samples.push(sample);
    if (mbps > peak) peak = mbps;
    opts.onSample?.(mbps, sample);
  }, 200);

  const launched: Promise<void>[] = [];
  for (let i = 0; i < streams; i++) launched.push(runStream());

  await new Promise<void>((resolve) => {
    const stop = setTimeout(resolve, durationMs);
    opts.signal?.addEventListener('abort', () => { clearTimeout(stop); resolve(); }, { once: true });
  });

  active = false;
  clearInterval(sampler);
  await Promise.race([Promise.allSettled(launched), new Promise((r) => setTimeout(r, 400))]);

  const endTime = performance.now();
  const durationActual = endTime - phaseStart;

  let mbps: number;
  if (warmupBytes >= 0 && endTime - warmupTime > 500) {
    const windowBytes = totalBytes - warmupBytes;
    const windowSec = (endTime - warmupTime) / 1000;
    mbps = windowSec > 0 ? (windowBytes * BITS_PER_BYTE) / windowSec / MB : 0;
  } else {
    mbps = (totalBytes * BITS_PER_BYTE) / (durationActual / 1000) / MB;
  }

  return {
    mbps: Math.round(mbps * 100) / 100,
    peak: Math.round(peak * 100) / 100,
    samples,
    bytes: totalBytes,
    durationMs: durationActual,
  };
}
