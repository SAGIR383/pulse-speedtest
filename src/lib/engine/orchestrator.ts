import { measureLatency } from './latency';
import { measureDownload } from './download';
import { measureUpload } from './upload';
import { measureLatencyCf } from './latency-cf';
import { measureDownloadCf } from './download-cf';
import { measureUploadCf } from './upload-cf';
import { LoadedLatencyProbe } from './loaded-latency';
import { detectConnection } from './connection';
import { computeHealthScore } from '../ai/score';
import type {
  LiveState,
  TestResult,
  ServerInfo,
  LocationInfo,
  ThroughputSample,
} from './types';

/**
 * SpeedTestEngine orchestrates the full measurement sequence and streams a
 * LiveState object to the UI on every update so visuals stay in sync with
 * the real network activity.
 */

/**
 * Which measurement backend to use:
 *  - 'origin'     → our own Next.js API routes (measures path to our CDN edge).
 *  - 'cloudflare' → speed.cloudflare.com endpoints (measures path to Cloudflare's
 *                   nearest node; closer to real ISP throughput, à la Ookla).
 */
export type MeasurementBackend = 'origin' | 'cloudflare';

export interface EngineEndpoints {
  ping: string;
  download: string;
  upload: string;
}

export interface RunOptions {
  endpoints: EngineEndpoints;
  server: ServerInfo;
  location: LocationInfo | null;
  isp: string | null;
  onState: (state: LiveState) => void;
  signal?: AbortSignal;
  /** Measurement backend; defaults to 'cloudflare' for ISP-accurate results. */
  backend?: MeasurementBackend;
}

const blankState = (): LiveState => ({
  phase: 'idle',
  progress: 0,
  current: 0,
  download: 0,
  upload: 0,
  ping: 0,
  jitter: 0,
  packetLoss: 0,
  samples: [],
  latencySamples: [],
});

export async function runSpeedTest(opts: RunOptions): Promise<TestResult> {
  const backend: MeasurementBackend = opts.backend ?? 'cloudflare';
  const state = blankState();
  const emit = () => opts.onState({ ...state, samples: [...state.samples], latencySamples: [...state.latencySamples] });

  // --- Phase 1: connect / warm up ---
  state.phase = 'connecting';
  state.progress = 0;
  emit();
  await new Promise((r) => setTimeout(r, 400));

  // --- Phase 2: latency, jitter, packet loss ---
  state.phase = 'latency';
  state.samples = [];
  state.latencySamples = [];
  emit();

  const onLatencySample = (rtt: number, index: number, total: number) => {
    state.progress = (index + 1) / total;
    state.current = rtt;
    state.ping = Math.round(rtt * 10) / 10;
    state.latencySamples.push(rtt);
    emit();
  };

  const latency =
    backend === 'cloudflare'
      ? await measureLatencyCf({ samples: 24, signal: opts.signal, onSample: onLatencySample })
      : await measureLatency({
          endpoint: opts.endpoints.ping,
          samples: 24,
          signal: opts.signal,
          onSample: onLatencySample,
        });
  state.ping = latency.ping;
  state.jitter = latency.jitter;
  state.packetLoss = latency.packetLoss;
  emit();

  // --- Phase 3: download ---
  state.phase = 'download';
  state.progress = 0;
  state.current = 0;
  state.samples = [];
  emit();

  const dlDuration = backend === 'cloudflare' ? 10000 : 9000;
  const onDownloadSample = (mbps: number, sample: ThroughputSample) => {
    state.current = mbps;
    state.download = Math.round(mbps * 100) / 100;
    state.progress = Math.min(1, sample.t / dlDuration);
    state.samples.push(sample);
    emit();
  };

  // Start a loaded-latency probe concurrently with the download to measure
  // bufferbloat — how much latency rises while the link is saturated.
  const bloatProbe = new LoadedLatencyProbe();
  bloatProbe.start(opts.signal);

  const download =
    backend === 'cloudflare'
      ? await measureDownloadCf({ durationMs: dlDuration, signal: opts.signal, onSample: onDownloadSample })
      : await measureDownload({
          endpoint: opts.endpoints.download,
          durationMs: dlDuration,
          signal: opts.signal,
          onSample: onDownloadSample,
        });
  bloatProbe.stop();
  const loadedLatency = bloatProbe.result();
  state.download = download.mbps;
  state.current = download.mbps;
  emit();

  // --- Phase 4: upload ---
  state.phase = 'upload';
  state.progress = 0;
  state.current = 0;
  state.samples = [];
  emit();

  const ulDuration = backend === 'cloudflare' ? 10000 : 9000;
  const onUploadSample = (mbps: number, sample: ThroughputSample) => {
    state.current = mbps;
    state.upload = Math.round(mbps * 100) / 100;
    state.progress = Math.min(1, sample.t / ulDuration);
    state.samples.push(sample);
    emit();
  };
  const upload =
    backend === 'cloudflare'
      ? await measureUploadCf({ durationMs: ulDuration, signal: opts.signal, onSample: onUploadSample })
      : await measureUpload({
          endpoint: opts.endpoints.upload,
          durationMs: ulDuration,
          signal: opts.signal,
          onSample: onUploadSample,
        });
  state.upload = upload.mbps;
  state.current = upload.mbps;
  emit();

  // --- Phase 5: analyze ---
  state.phase = 'analyzing';
  state.progress = 0.5;
  emit();
  await new Promise((r) => setTimeout(r, 600));

  const healthScore = computeHealthScore({
    download: download.mbps,
    upload: upload.mbps,
    ping: latency.ping,
    jitter: latency.jitter,
    packetLoss: latency.packetLoss,
  });

  const conn = detectConnection();
  const bufferbloat = loadedLatency > 0 ? Math.max(0, Math.round((loadedLatency - latency.ping) * 10) / 10) : undefined;

  const result: TestResult = {
    id: `pulse_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    timestamp: Date.now(),
    download: download.mbps,
    upload: upload.mbps,
    ping: latency.ping,
    jitter: latency.jitter,
    packetLoss: latency.packetLoss,
    latency,
    downloadDetail: download,
    uploadDetail: upload,
    server: opts.server,
    location: opts.location,
    isp: opts.isp,
    healthScore,
    loadedLatency: loadedLatency > 0 ? loadedLatency : undefined,
    bufferbloat,
    connectionType: conn.type !== 'unknown' ? conn.label : undefined,
  };

  state.phase = 'complete';
  state.progress = 1;
  emit();

  return result;
}
