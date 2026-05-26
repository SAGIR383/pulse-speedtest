'use client';

/**
 * Loaded-latency (bufferbloat) probe.
 *
 * Bufferbloat is the latency increase a connection suffers WHILE it's busy
 * transferring data. A line can have a great idle ping (e.g. 20ms) yet balloon
 * to 300ms under load — which is what actually ruins video calls and gaming
 * during a download. Idle ping alone hides this; measuring ping *during* the
 * download exposes it.
 *
 * This runs alongside the download phase: it fires lightweight latency probes
 * continuously and reports the median RTT observed while the link is saturated.
 */

const CF_DOWN = 'https://speed.cloudflare.com/__down';

export class LoadedLatencyProbe {
  private rtts: number[] = [];
  private running = false;
  private endpoint: string;

  constructor(endpoint?: string) {
    // Use a tiny Cloudflare download as the probe target by default.
    this.endpoint = endpoint ?? `${CF_DOWN}?bytes=1`;
  }

  start(signal?: AbortSignal): void {
    this.running = true;
    void this.loop(signal);
  }

  private async loop(signal?: AbortSignal): Promise<void> {
    while (this.running && !signal?.aborted) {
      const t0 = performance.now();
      try {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 3000);
        await fetch(`${this.endpoint}&t=${performance.now()}_${Math.random()}`, {
          cache: 'no-store',
          signal: signal ?? ctrl.signal,
        });
        clearTimeout(timer);
        this.rtts.push(performance.now() - t0);
      } catch {
        /* a dropped probe under heavy load is itself a signal; skip it */
      }
      // Small gap so probes don't themselves saturate the link.
      await new Promise((r) => setTimeout(r, 120));
    }
  }

  stop(): void {
    this.running = false;
  }

  /** Median loaded RTT in ms (0 if no samples). */
  result(): number {
    if (this.rtts.length === 0) return 0;
    const sorted = [...this.rtts].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    const median = sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
    return Math.round(median * 10) / 10;
  }

  get sampleCount(): number {
    return this.rtts.length;
  }
}
