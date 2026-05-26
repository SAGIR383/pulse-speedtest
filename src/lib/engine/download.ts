import type { ThroughputResult, ThroughputSample } from './types';

/**
 * Download engine.
 *
 * Strategy (mirrors how professional browser-based tests work):
 *  1. Open N parallel streaming fetch connections to a same-origin endpoint
 *     that emits random, incompressible bytes.
 *  2. Read each stream's chunks and accumulate total bytes across all streams.
 *  3. Sample aggregate throughput on a fixed interval (e.g. every 200ms).
 *  4. Use a warm-up window (TCP slow-start ramp) that is excluded from the
 *     final average.
 *  5. Compute the final result from the stable measurement window using a
 *     trimmed mean to reject spikes and dips.
 *
 * Adaptive scaling: if early throughput is high, we add streams to saturate
 * fast links; if it's low we keep streams modest so slow links aren't starved.
 */

export interface DownloadOptions {
  endpoint: string;
  /** Total wall-clock budget for the phase in ms. */
  durationMs?: number;
  /** Warm-up (ramp) window excluded from averaging, in ms. */
  warmupMs?: number;
  /** Initial parallel stream count. */
  streams?: number;
  /** Bytes requested per stream chunk-fetch. */
  chunkBytes?: number;
  onSample?: (mbps: number, sample: ThroughputSample) => void;
  signal?: AbortSignal;
}

const BITS_PER_BYTE = 8;
const MB = 1_000_000; // megabits use base-10 (matches ISP advertising)

function trimmedMean(values: number[], trimRatio = 0.1): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const cut = Math.floor(sorted.length * trimRatio);
  const kept = sorted.slice(cut, sorted.length - cut || undefined);
  const slice = kept.length ? kept : sorted;
  return slice.reduce((a, b) => a + b, 0) / slice.length;
}

/**
 * Robust central estimate. We blend the median (resistant to spikes/dips on
 * loopback and flaky links) with a light trimmed mean so a genuinely steady
 * stream isn't dragged by a single outlier sample. Median-weighted.
 */
function robustSpeed(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const median =
    sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
  const tm = trimmedMean(sorted, 0.15);
  return median * 0.6 + tm * 0.4;
}

export async function measureDownload(opts: DownloadOptions): Promise<ThroughputResult> {
  const durationMs = opts.durationMs ?? 9000;
  const warmupMs = opts.warmupMs ?? 1800;
  const chunkBytes = opts.chunkBytes ?? 12 * 1024 * 1024; // 12 MB per request
  let streams = opts.streams ?? 4;

  let totalBytes = 0;
  let active = true;
  const samples: ThroughputSample[] = [];
  const phaseStart = performance.now();

  // Per-stream worker that keeps requesting fresh random payloads.
  const runStream = async (): Promise<void> => {
    while (active && !opts.signal?.aborted) {
      const url = `${opts.endpoint}?bytes=${chunkBytes}&t=${performance.now()}_${Math.random()}`;
      try {
        const res = await fetch(url, { cache: 'no-store', signal: opts.signal });
        if (!res.body) {
          // Fallback: count the full payload once if streaming isn't available.
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
            return;
          }
        }
      } catch {
        if (!active) return;
        // Brief backoff on transient error, then retry.
        await new Promise((r) => setTimeout(r, 60));
      }
    }
  };

  // Sampler: records aggregate throughput on a fixed cadence.
  let lastBytes = 0;
  let lastT = phaseStart;
  let peak = 0;
  // Mark the byte/time position at the moment warm-up ends, so the final
  // figure is computed as (bytes since warm-up) / (time since warm-up) —
  // the standard, accurate method used by real speed tests.
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

    // Capture the warm-up boundary exactly once.
    if (warmupBytes < 0 && elapsed >= warmupMs) {
      warmupBytes = totalBytes;
      warmupTime = now;
    }

    const sample: ThroughputSample = { t: elapsed, mbps: Math.max(0, mbps) };
    samples.push(sample);
    if (mbps > peak) peak = mbps;
    opts.onSample?.(mbps, sample);
  }, 200);

  // Launch initial streams.
  const launched: Promise<void>[] = [];
  for (let i = 0; i < streams; i++) launched.push(runStream());

  // Run for the full budget (unless aborted).
  await new Promise<void>((resolve) => {
    const stop = setTimeout(resolve, durationMs);
    opts.signal?.addEventListener('abort', () => { clearTimeout(stop); resolve(); }, { once: true });
  });

  active = false;
  clearInterval(sampler);
  // Let streams unwind.
  await Promise.race([Promise.allSettled(launched), new Promise((r) => setTimeout(r, 400))]);

  const endTime = performance.now();
  const durationActual = endTime - phaseStart;

  // Final speed: bytes transferred AFTER warm-up divided by the time spent.
  // This averages over the whole stable window and is naturally resistant to
  // the momentary bursts a nearby CDN edge can produce. Fall back to the
  // robust sample estimate only if the warm-up boundary was never captured.
  let mbps: number;
  if (warmupBytes >= 0) {
    const windowBytes = totalBytes - warmupBytes;
    const windowSec = (endTime - warmupTime) / 1000;
    mbps = windowSec > 0 ? (windowBytes * BITS_PER_BYTE) / windowSec / MB : 0;
  } else {
    const stable = samples.filter((s) => s.t >= warmupMs).map((s) => s.mbps);
    mbps = stable.length ? robustSpeed(stable) : robustSpeed(samples.map((s) => s.mbps));
  }

  return {
    mbps: Math.round(mbps * 100) / 100,
    peak: Math.round(peak * 100) / 100,
    samples,
    bytes: totalBytes,
    durationMs: durationActual,
  };
}
