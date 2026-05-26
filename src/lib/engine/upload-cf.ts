import type { ThroughputResult, ThroughputSample } from './types';

/**
 * Cloudflare-backed upload measurement.
 *
 * POSTs random incompressible data to Cloudflare's speed test upload endpoint
 * directly from the browser, so the measured path is the user's real uplink to
 * Cloudflare's nearest node — not our app origin.
 *
 * Endpoint: https://speed.cloudflare.com/__up  (POST, body is discarded)
 */

const BITS_PER_BYTE = 8;
const MB = 1_000_000;
const CF_UP = 'https://speed.cloudflare.com/__up';

export interface CfUploadOptions {
  durationMs?: number;
  warmupMs?: number;
  chunkBytes?: number;
  streams?: number;
  signal?: AbortSignal;
  onSample?: (mbps: number, sample: ThroughputSample) => void;
}

function makeRandomBlob(bytes: number): Blob {
  const buf = new Uint8Array(bytes);
  // Fill with random data in 64KB windows (crypto limit per call).
  const STEP = 65536;
  for (let off = 0; off < bytes; off += STEP) {
    crypto.getRandomValues(buf.subarray(off, Math.min(off + STEP, bytes)));
  }
  return new Blob([buf], { type: 'application/octet-stream' });
}

export async function measureUploadCf(
  opts: CfUploadOptions = {}
): Promise<ThroughputResult> {
  const durationMs = opts.durationMs ?? 10_000;
  const warmupMs = opts.warmupMs ?? 1000;
  // 512 KB chunks: on a ~30 Mbps uplink each POST takes ~140ms, so dozens
  // complete within the window — plenty of per-request speed samples.
  const chunkBytes = opts.chunkBytes ?? 512 * 1024;
  const streams = opts.streams ?? 3;

  const pool: Blob[] = [];
  for (let i = 0; i < Math.max(2, streams); i++) pool.push(makeRandomBlob(chunkBytes));

  let confirmedBytes = 0;
  let active = true;
  const samples: ThroughputSample[] = [];
  const phaseStart = performance.now();

  // Per-request speed samples. This is how Cloudflare's own engine computes
  // upload bandwidth: time each individual POST and divide its byte size by
  // its duration. A browser fetch POST resolves only after the whole body is
  // sent, so each completed request yields one honest throughput reading —
  // robust even when only a handful finish within the time budget.
  const reqSpeeds: number[] = [];
  let peak = 0;

  const runStream = async (poolIdx: number): Promise<void> => {
    while (active && !opts.signal?.aborted) {
      const blob = pool[poolIdx % pool.length];
      const reqStart = performance.now();
      try {
        await fetch(CF_UP, {
          method: 'POST',
          cache: 'no-store',
          body: blob,
          signal: opts.signal,
          headers: { 'content-type': 'application/octet-stream' },
        });
        const reqMs = performance.now() - reqStart;
        if (!opts.signal?.aborted && reqMs > 0) {
          confirmedBytes += blob.size;
          const reqMbps = (blob.size * BITS_PER_BYTE) / (reqMs / 1000) / MB;
          const elapsed = performance.now() - phaseStart;
          // Exclude warm-up requests (connection ramp) from the final set.
          if (elapsed >= warmupMs) reqSpeeds.push(reqMbps);
          const sample: ThroughputSample = { t: elapsed, mbps: reqMbps };
          samples.push(sample);
          if (reqMbps > peak) peak = reqMbps;
          opts.onSample?.(reqMbps, sample);
        }
      } catch {
        if (!active) return;
        await new Promise((r) => setTimeout(r, 40));
      }
    }
  };

  const launched: Promise<void>[] = [];
  for (let i = 0; i < streams; i++) launched.push(runStream(i));

  await new Promise<void>((resolve) => {
    const stop = setTimeout(resolve, durationMs);
    opts.signal?.addEventListener('abort', () => { clearTimeout(stop); resolve(); }, { once: true });
  });

  active = false;
  await Promise.race([Promise.allSettled(launched), new Promise((r) => setTimeout(r, 600))]);

  const endTime = performance.now();
  const durationActual = endTime - phaseStart;

  // Aggregate per-request speeds. With multiple concurrent streams the link's
  // true capacity is the SUM of simultaneous request speeds, so we estimate it
  // as the median single-request speed times the stream count, then sanity-cap
  // by the total-bytes-over-time figure (which can't exceed real throughput).
  let mbps: number;
  const usable = reqSpeeds.length ? reqSpeeds : samples.map((s) => s.mbps);
  if (usable.length > 0) {
    const sorted = [...usable].sort((a, b) => a - b);
    const medianReq = sorted[Math.floor(sorted.length / 2)];
    const aggregate = medianReq * streams;
    const overall =
      confirmedBytes > 0
        ? (confirmedBytes * BITS_PER_BYTE) / (durationActual / 1000) / MB
        : 0;
    // Use the aggregate but never report more than the overall transfer allows.
    mbps = overall > 0 ? Math.min(aggregate, overall * 1.1) : aggregate;
  } else {
    mbps = 0;
  }

  return {
    mbps: Math.round(mbps * 100) / 100,
    peak: Math.round(peak * 100) / 100,
    samples,
    bytes: confirmedBytes,
    durationMs: durationActual,
  };
}
