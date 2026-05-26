/**
 * Internet health scoring.
 *
 * A transparent, weighted, rule-based model (no external AI). Each metric is
 * mapped to a 0-100 sub-score via piecewise curves tuned to real-world
 * experience thresholds, then combined with weights reflecting how much each
 * factor affects everyday usage.
 */

export interface ScoreInput {
  download: number; // Mbps
  upload: number; // Mbps
  ping: number; // ms
  jitter: number; // ms
  packetLoss: number; // %
}

/** Smooth-ish piecewise scoring helpers. */
const clamp = (v: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, v));

export function scoreDownload(mbps: number): number {
  // 0 -> 0, 25 -> 60, 100 -> 85, 300 -> 95, 1000+ -> 100
  if (mbps <= 0) return 0;
  if (mbps < 25) return clamp((mbps / 25) * 60);
  if (mbps < 100) return clamp(60 + ((mbps - 25) / 75) * 25);
  if (mbps < 300) return clamp(85 + ((mbps - 100) / 200) * 10);
  if (mbps < 1000) return clamp(95 + ((mbps - 300) / 700) * 5);
  return 100;
}

export function scoreUpload(mbps: number): number {
  if (mbps <= 0) return 0;
  if (mbps < 5) return clamp((mbps / 5) * 50);
  if (mbps < 20) return clamp(50 + ((mbps - 5) / 15) * 25);
  if (mbps < 100) return clamp(75 + ((mbps - 20) / 80) * 20);
  return 100;
}

export function scorePing(ms: number): number {
  // Lower is better. <20ms excellent, 100ms+ poor.
  if (ms <= 0) return 0;
  if (ms <= 20) return 100;
  if (ms <= 50) return clamp(100 - ((ms - 20) / 30) * 20);
  if (ms <= 100) return clamp(80 - ((ms - 50) / 50) * 30);
  if (ms <= 200) return clamp(50 - ((ms - 100) / 100) * 30);
  return clamp(20 - (ms - 200) / 20);
}

export function scoreJitter(ms: number): number {
  if (ms <= 2) return 100;
  if (ms <= 10) return clamp(100 - ((ms - 2) / 8) * 25);
  if (ms <= 30) return clamp(75 - ((ms - 10) / 20) * 35);
  if (ms <= 60) return clamp(40 - ((ms - 30) / 30) * 30);
  return clamp(10 - (ms - 60) / 10);
}

export function scorePacketLoss(pct: number): number {
  if (pct <= 0) return 100;
  if (pct <= 0.5) return clamp(100 - pct * 20);
  if (pct <= 2) return clamp(90 - (pct - 0.5) * 20);
  if (pct <= 5) return clamp(60 - (pct - 2) * 12);
  return clamp(24 - (pct - 5) * 4);
}

export function computeHealthScore(input: ScoreInput): number {
  const sub = {
    download: scoreDownload(input.download),
    upload: scoreUpload(input.upload),
    ping: scorePing(input.ping),
    jitter: scoreJitter(input.jitter),
    packetLoss: scorePacketLoss(input.packetLoss),
  };

  // Weights: throughput matters, but a low-latency, stable link feels better
  // day-to-day, so latency factors carry real weight.
  const weighted =
    sub.download * 0.32 +
    sub.upload * 0.16 +
    sub.ping * 0.22 +
    sub.jitter * 0.16 +
    sub.packetLoss * 0.14;

  return Math.round(clamp(weighted));
}
