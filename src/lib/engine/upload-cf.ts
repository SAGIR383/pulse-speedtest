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
  const warmupMs = opts.warmupMs ?? 1500;
  // 1 MB chunks: large enough to be efficient, small enough that many complete
  // within the window on slower uplinks so sampling stays continuous.
  const chunkBytes = opts.chunkBytes ?? 1 * 1024 * 1024;
  const streams = opts.streams ?? 3;

  const pool: Blob[] = [];
  for (let i = 0; i < Math.max(2, streams); i++) pool.push(makeRandomBlob(chunkBytes));

  let confirmedBytes = 0;
  let active = true;
  const samples: ThroughputSample[] = [];
  const phaseStart = performance.now();

  const runStream = async (poolIdx: number): Promise<void> => {
    while (active && !opts.signal?.aborted) {
      const blob = pool[poolIdx % pool.length];
      try {
        await fetch(CF_UP, {
          method: 'POST',
          cache: 'no-store',
          body: blob,
          signal: opts.signal,
          headers: { 'content-type': 'application/octet-stream' },
        });
        if (!opts.signal?.aborted) confirmedBytes += blob.size;
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
    const deltaBytes = confirmedBytes - lastBytes;
    const mbps = (deltaBytes * BITS_PER_BYTE) / dt / MB;
    lastBytes = confirmedBytes;
    lastT = now;
    if (warmupBytes < 0 && elapsed >= warmupMs) {
      warmupBytes = confirmedBytes;
      warmupTime = now;
    }
    const sample: ThroughputSample = { t: elapsed, mbps: Math.max(0, mbps) };
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

  const endTime = performance.now();
  const durationActual = endTime - phaseStart;

  let mbps: number;
  if (warmupBytes >= 0 && endTime - warmupTime > 500) {
    const windowBytes = confirmedBytes - warmupBytes;
    const windowSec = (endTime - warmupTime) / 1000;
    mbps = windowSec > 0 ? (windowBytes * BITS_PER_BYTE) / windowSec / MB : 0;
  } else if (confirmedBytes > 0) {
    mbps = (confirmedBytes * BITS_PER_BYTE) / (durationActual / 1000) / MB;
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
