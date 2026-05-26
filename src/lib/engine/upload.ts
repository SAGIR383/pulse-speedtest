import type { ThroughputResult, ThroughputSample } from './types';

/**
 * Upload engine.
 *
 * Strategy:
 *  1. Generate incompressible random payloads in advance (so payload creation
 *     time is not counted against throughput).
 *  2. POST them over N parallel streams to a same-origin sink endpoint that
 *     discards the body and replies immediately.
 *  3. Because the browser fetch() upload progress is not streamable in all
 *     engines, we measure by counting completed payload bytes per sampling
 *     interval — i.e. bytes acknowledged as fully sent when each POST resolves.
 *  4. Warm-up window excluded, trimmed mean for the final figure.
 *
 * To keep memory low we reuse a small pool of pre-built payload blobs.
 */

export interface UploadOptions {
  endpoint: string;
  durationMs?: number;
  warmupMs?: number;
  streams?: number;
  /** Size of each uploaded chunk in bytes. */
  chunkBytes?: number;
  onSample?: (mbps: number, sample: ThroughputSample) => void;
  signal?: AbortSignal;
}

const BITS_PER_BYTE = 8;
const MB = 1_000_000;

function trimmedMean(values: number[], trimRatio = 0.1): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const cut = Math.floor(sorted.length * trimRatio);
  const kept = sorted.slice(cut, sorted.length - cut || undefined);
  const slice = kept.length ? kept : sorted;
  return slice.reduce((a, b) => a + b, 0) / slice.length;
}

/** Robust median-weighted central estimate (see download.ts for rationale). */
function robustSpeed(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const median =
    sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
  const tm = trimmedMean(sorted, 0.15);
  return median * 0.6 + tm * 0.4;
}

/** Build an incompressible random blob (so proxies/gzip can't shrink it). */
function makeRandomBlob(bytes: number): Blob {
  const buf = new Uint8Array(bytes);
  // crypto.getRandomValues caps at 65536 bytes per call.
  const step = 65536;
  for (let off = 0; off < bytes; off += step) {
    crypto.getRandomValues(buf.subarray(off, Math.min(off + step, bytes)));
  }
  return new Blob([buf], { type: 'application/octet-stream' });
}

export async function measureUpload(opts: UploadOptions): Promise<ThroughputResult> {
  const durationMs = opts.durationMs ?? 9000;
  const warmupMs = opts.warmupMs ?? 1800;
  const chunkBytes = opts.chunkBytes ?? 2 * 1024 * 1024; // 2 MB per POST
  const streams = opts.streams ?? 4;

  // Pre-build a small pool of payloads to reuse.
  const pool: Blob[] = [];
  for (let i = 0; i < Math.max(2, streams); i++) pool.push(makeRandomBlob(chunkBytes));

  let confirmedBytes = 0;
  let active = true;
  const samples: ThroughputSample[] = [];
  const phaseStart = performance.now();

  const runStream = async (poolIdx: number): Promise<void> => {
    while (active && !opts.signal?.aborted) {
      const blob = pool[poolIdx % pool.length];
      const url = `${opts.endpoint}?t=${performance.now()}_${Math.random()}`;
      try {
        const res = await fetch(url, {
          method: 'POST',
          cache: 'no-store',
          body: blob,
          signal: opts.signal,
          headers: { 'content-type': 'application/octet-stream' },
        });
        // Count bytes ONLY when the server actually confirms full receipt.
        // (An aborted or failed POST must not inflate the byte total.)
        if (res.ok && !opts.signal?.aborted) {
          confirmedBytes += blob.size;
        }
      } catch {
        if (!active) return;
        await new Promise((r) => setTimeout(r, 60));
      }
    }
  };

  let lastBytes = 0;
  let lastT = phaseStart;
  let peak = 0;
  const sampler = setInterval(() => {
    const now = performance.now();
    const dt = (now - lastT) / 1000;
    if (dt <= 0) return;
    const deltaBytes = confirmedBytes - lastBytes;
    const mbps = (deltaBytes * BITS_PER_BYTE) / dt / MB;
    lastBytes = confirmedBytes;
    lastT = now;
    const sample: ThroughputSample = { t: now - phaseStart, mbps: Math.max(0, mbps) };
    samples.push(sample);
    if (mbps > peak) peak = mbps;
    opts.onSample?.(mbps, sample);
  }, 200);

  const launched: Promise<void>[] = [];
  for (let i = 0; i < streams; i++) launched.push(runStream(i));

  await new Promise<void>((resolve) => {
    const stop = setTimeout(resolve, durationMs);
    opts.signal?.addEventListener('abort', () => { clearTimeout(stop); resolve(); }, { once: true });
  });

  active = false;
  clearInterval(sampler);
  await Promise.race([Promise.allSettled(launched), new Promise((r) => setTimeout(r, 400))]);

  const durationActual = performance.now() - phaseStart;
  const stable = samples.filter((s) => s.t >= warmupMs).map((s) => s.mbps);
  const mbps = stable.length >= 3 ? robustSpeed(stable) : robustSpeed(samples.map((s) => s.mbps));

  return {
    mbps: Math.round(mbps * 100) / 100,
    peak: Math.round(peak * 100) / 100,
    samples,
    bytes: confirmedBytes,
    durationMs: durationActual,
  };
}
