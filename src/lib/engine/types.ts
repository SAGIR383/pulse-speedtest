/**
 * Core type definitions shared across the measurement engine,
 * the AI diagnostics layer, and the UI.
 */

export type TestPhase =
  | 'idle'
  | 'connecting'
  | 'latency'
  | 'download'
  | 'upload'
  | 'analyzing'
  | 'complete'
  | 'error';

/** A single throughput sample emitted during a download/upload phase. */
export interface ThroughputSample {
  /** Milliseconds since the phase started. */
  t: number;
  /** Instantaneous throughput in megabits per second. */
  mbps: number;
}

/** Latency-related results. */
export interface LatencyResult {
  /** Idle/unloaded round-trip latency in ms (median of samples). */
  ping: number;
  /** Latency variation in ms (mean absolute difference between consecutive RTTs). */
  jitter: number;
  /** Minimum observed RTT (best case). */
  min: number;
  /** Maximum observed RTT (worst case). */
  max: number;
  /** All individual RTT samples for visualization. */
  samples: number[];
  /** Estimated packet loss percentage (0-100). */
  packetLoss: number;
}

/** Download or upload phase results. */
export interface ThroughputResult {
  /** Final stabilized speed in Mbps. */
  mbps: number;
  /** Peak observed throughput. */
  peak: number;
  /** All instantaneous samples for the live waveform. */
  samples: ThroughputSample[];
  /** Total bytes transferred during measurement window. */
  bytes: number;
  /** Effective measurement duration in ms. */
  durationMs: number;
}

/** Full result of a completed test. */
export interface TestResult {
  id: string;
  timestamp: number;
  download: number;
  upload: number;
  ping: number;
  jitter: number;
  packetLoss: number;
  latency: LatencyResult;
  downloadDetail: ThroughputResult;
  uploadDetail: ThroughputResult;
  server: ServerInfo;
  location: LocationInfo | null;
  isp: string | null;
  /** AI health score 0-100. */
  healthScore: number;
}

export interface ServerInfo {
  id: string;
  label: string;
  /** Same-origin by default; the app uses its own API routes. */
  url: string;
  lat: number;
  lng: number;
  distanceKm: number | null;
}

export interface LocationInfo {
  lat: number;
  lng: number;
  city: string | null;
  region: string | null;
  country: string | null;
  /** 'gps' | 'ip' | 'unknown' */
  source: 'gps' | 'ip' | 'unknown';
  accuracyM: number | null;
}

/** Live state the engine streams to the UI during a test. */
export interface LiveState {
  phase: TestPhase;
  /** 0-1 progress within the current phase. */
  progress: number;
  /** Current instantaneous metric value (Mbps for throughput, ms for latency). */
  current: number;
  download: number;
  upload: number;
  ping: number;
  jitter: number;
  packetLoss: number;
  samples: ThroughputSample[];
  latencySamples: number[];
}

/* ---- AI diagnostics ---- */

export type Verdict = 'excellent' | 'good' | 'fair' | 'poor';

export interface InsightCard {
  id: string;
  title: string;
  verdict: Verdict;
  /** Human-friendly one-liner. */
  summary: string;
  /** Optional detail / recommendation. */
  detail?: string;
  /** 0-100 sub-score for the ring visualization. */
  score: number;
  icon: string;
}

export interface StreamingTier {
  label: string;
  resolution: string;
  requiredMbps: number;
  supported: boolean;
  margin: number; // how much headroom (x times required)
}

export interface Diagnostics {
  healthScore: number;
  headline: string;
  summary: string;
  cards: InsightCard[];
  streaming: StreamingTier[];
  recommendations: string[];
}
