/// <reference lib="webworker" />
/**
 * Speed test Web Worker.
 *
 * Runs the full measurement orchestration off the main thread so the
 * cinematic UI (canvas flux field, waveforms, spring counters) never drops
 * frames while the network is saturated. The worker imports the exact same
 * engine modules used on the main thread — fetch, performance.now(),
 * ReadableStream and crypto.getRandomValues are all available in the worker
 * scope, so measurement behavior is identical.
 *
 * Protocol
 * --------
 * Main -> Worker:
 *   { type: 'start', payload: { endpoints, server, location, isp } }
 *   { type: 'cancel' }
 *
 * Worker -> Main:
 *   { type: 'state',  payload: LiveState }     // streamed continuously
 *   { type: 'result', payload: TestResult }    // once, on success
 *   { type: 'error',  payload: { message } }   // on failure
 */
import { runSpeedTest } from '../lib/engine/orchestrator';
import type { EngineEndpoints } from '../lib/engine/orchestrator';
import type { ServerInfo, LocationInfo } from '../lib/engine/types';

interface StartPayload {
  endpoints: EngineEndpoints;
  server: ServerInfo;
  location: LocationInfo | null;
  isp: string | null;
  backend?: 'origin' | 'cloudflare';
}

type InboundMessage =
  | { type: 'start'; payload: StartPayload }
  | { type: 'cancel' };

const ctx = self as unknown as DedicatedWorkerGlobalScope;

let controller: AbortController | null = null;

ctx.addEventListener('message', async (event: MessageEvent<InboundMessage>) => {
  const msg = event.data;

  if (msg.type === 'cancel') {
    controller?.abort();
    return;
  }

  if (msg.type === 'start') {
    // Abort any in-flight run before starting a new one.
    controller?.abort();
    controller = new AbortController();

    const { endpoints, server, location, isp, backend } = msg.payload;

    try {
      const result = await runSpeedTest({
        endpoints,
        server,
        location,
        isp,
        backend,
        signal: controller.signal,
        onState: (state) => {
          ctx.postMessage({ type: 'state', payload: state });
        },
      });
      ctx.postMessage({ type: 'result', payload: result });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Speed test failed in worker';
      // Swallow expected abort errors quietly.
      if (controller?.signal.aborted) {
        ctx.postMessage({ type: 'error', payload: { message: 'aborted' } });
      } else {
        ctx.postMessage({ type: 'error', payload: { message } });
      }
    } finally {
      controller = null;
    }
  }
});

export {};
