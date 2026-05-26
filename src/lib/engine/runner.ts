'use client';

import { runSpeedTest } from '../engine/orchestrator';
import type { EngineEndpoints } from '../engine/orchestrator';
import type {
  LiveState,
  TestResult,
  ServerInfo,
  LocationInfo,
} from '../engine/types';

/**
 * runSpeedTestClient
 * ------------------
 * Runs a full speed test, preferring a Web Worker so the main thread stays
 * free for the cinematic UI. Falls back transparently to the main-thread
 * orchestrator when Workers are unavailable (older browsers, SSR, or
 * sandboxed contexts).
 *
 * The returned object exposes a `promise` that resolves with the TestResult
 * and a `cancel()` method that aborts the run cleanly.
 */

export interface ClientRunOptions {
  endpoints: EngineEndpoints;
  server: ServerInfo;
  location: LocationInfo | null;
  isp: string | null;
  onState: (state: LiveState) => void;
}

export interface ClientRunHandle {
  promise: Promise<TestResult>;
  cancel: () => void;
  /** Which execution path was taken — useful for diagnostics/telemetry. */
  mode: 'worker' | 'main';
}

function workerSupported(): boolean {
  return typeof window !== 'undefined' && typeof Worker !== 'undefined';
}

export function runSpeedTestClient(opts: ClientRunOptions): ClientRunHandle {
  // --- Preferred path: Web Worker ---
  if (workerSupported()) {
    try {
      // The bundler (Next/Turbopack/webpack 5) resolves this URL form into a
      // proper worker chunk. Module workers keep our ESM imports intact.
      const worker = new Worker(
        new URL('../../workers/speedtest.worker.ts', import.meta.url),
        { type: 'module' }
      );

      let settled = false;

      const promise = new Promise<TestResult>((resolve, reject) => {
        worker.onmessage = (
          event: MessageEvent<
            | { type: 'state'; payload: LiveState }
            | { type: 'result'; payload: TestResult }
            | { type: 'error'; payload: { message: string } }
          >
        ) => {
          const msg = event.data;
          if (msg.type === 'state') {
            opts.onState(msg.payload);
          } else if (msg.type === 'result') {
            settled = true;
            resolve(msg.payload);
            worker.terminate();
          } else if (msg.type === 'error') {
            settled = true;
            if (msg.payload.message === 'aborted') {
              reject(new DOMException('Aborted', 'AbortError'));
            } else {
              reject(new Error(msg.payload.message));
            }
            worker.terminate();
          }
        };

        worker.onerror = (e) => {
          if (settled) return;
          settled = true;
          reject(new Error(e.message || 'Worker error'));
          worker.terminate();
        };
      });

      worker.postMessage({
        type: 'start',
        payload: {
          endpoints: opts.endpoints,
          server: opts.server,
          location: opts.location,
          isp: opts.isp,
        },
      });

      return {
        promise,
        mode: 'worker',
        cancel: () => {
          worker.postMessage({ type: 'cancel' });
          // Give the worker a tick to abort fetches, then hard-stop.
          setTimeout(() => worker.terminate(), 50);
        },
      };
    } catch {
      // Fall through to main-thread execution.
    }
  }

  // --- Fallback path: main thread ---
  const controller = new AbortController();
  const promise = runSpeedTest({
    endpoints: opts.endpoints,
    server: opts.server,
    location: opts.location,
    isp: opts.isp,
    signal: controller.signal,
    onState: opts.onState,
  });

  return {
    promise,
    mode: 'main',
    cancel: () => controller.abort(),
  };
}
