'use client';

/**
 * Service reachability checker.
 *
 * Answers the everyday question: "Is it my internet, or is the service down?"
 *
 * HONEST LIMITATION: a browser cannot read cross-origin responses (CORS), so we
 * can't fetch a real status code from google.com etc. Instead we issue a
 * `no-cors` request for a tiny well-known asset (favicon / generated_204) and
 * measure whether it RESPONDS at all and how quickly. A fast response → the
 * service is reachable from this device. A timeout/failure → either the service
 * is unreachable, down, or blocked on the path. We present it exactly that way:
 * "reachable from your device", not an authoritative outage verdict.
 *
 * We probe several services in parallel and also include a known-good anchor
 * (Cloudflare / Google 204) so the user can distinguish "my whole internet is
 * down" from "just this one service isn't responding".
 */

export interface ServiceTarget {
  id: string;
  name: string;
  /** A small, CORS-agnostic asset that returns quickly when the service is up. */
  url: string;
  /** Short hint about what this service represents. */
  category: string;
}

export interface ReachabilityResult {
  id: string;
  name: string;
  category: string;
  reachable: boolean;
  /** Round-trip time in ms if reachable, else null. */
  ms: number | null;
  status: 'reachable' | 'slow' | 'unreachable';
}

// Targets use endpoints that respond to no-cors opaque requests quickly.
// We append a cache-buster at probe time.
const TARGETS: ServiceTarget[] = [
  { id: 'google', name: 'Google', category: 'Search', url: 'https://www.google.com/favicon.ico' },
  { id: 'youtube', name: 'YouTube', category: 'Video', url: 'https://www.youtube.com/favicon.ico' },
  { id: 'whatsapp', name: 'WhatsApp', category: 'Messaging', url: 'https://static.whatsapp.net/favicon.ico' },
  { id: 'instagram', name: 'Instagram', category: 'Social', url: 'https://www.instagram.com/favicon.ico' },
  { id: 'facebook', name: 'Facebook', category: 'Social', url: 'https://www.facebook.com/favicon.ico' },
  { id: 'x', name: 'X (Twitter)', category: 'Social', url: 'https://abs.twimg.com/favicons/twitter.3.ico' },
  { id: 'cloudflare', name: 'Cloudflare', category: 'Internet anchor', url: 'https://cloudflare.com/cdn-cgi/trace' },
];

const SLOW_THRESHOLD_MS = 1500;
const TIMEOUT_MS = 5000;

async function probe(target: ServiceTarget): Promise<ReachabilityResult> {
  const start = performance.now();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    await fetch(`${target.url}?_=${Date.now()}`, {
      mode: 'no-cors', // opaque response: we can't read it, but the request still resolves on success
      cache: 'no-store',
      signal: ctrl.signal,
      redirect: 'follow',
    });
    clearTimeout(timer);
    const ms = Math.round(performance.now() - start);
    return {
      id: target.id,
      name: target.name,
      category: target.category,
      reachable: true,
      ms,
      status: ms > SLOW_THRESHOLD_MS ? 'slow' : 'reachable',
    };
  } catch {
    clearTimeout(timer);
    return {
      id: target.id,
      name: target.name,
      category: target.category,
      reachable: false,
      ms: null,
      status: 'unreachable',
    };
  }
}

export interface ReachabilityReport {
  results: ReachabilityResult[];
  /** True if the internet-anchor responded — i.e. the connection itself is up. */
  internetUp: boolean;
  /** Count of reachable services (excluding the anchor). */
  reachableCount: number;
  totalServices: number;
  /** Plain-language overall verdict. */
  verdict: string;
}

export async function checkServices(
  onProgress?: (done: number, total: number) => void
): Promise<ReachabilityReport> {
  const results: ReachabilityResult[] = [];
  let done = 0;
  await Promise.all(
    TARGETS.map(async (t) => {
      const r = await probe(t);
      results.push(r);
      done++;
      onProgress?.(done, TARGETS.length);
    })
  );

  // Preserve display order = TARGETS order.
  results.sort((a, b) => TARGETS.findIndex((t) => t.id === a.id) - TARGETS.findIndex((t) => t.id === b.id));

  const anchor = results.find((r) => r.id === 'cloudflare');
  const internetUp = anchor?.reachable ?? results.some((r) => r.reachable);
  const services = results.filter((r) => r.id !== 'cloudflare');
  const reachableCount = services.filter((r) => r.reachable).length;
  const totalServices = services.length;

  let verdict: string;
  if (!internetUp && reachableCount === 0) {
    verdict = 'Your internet connection appears to be down — nothing is responding from your device.';
  } else if (reachableCount === totalServices) {
    verdict = 'Everything looks healthy — all checked services are responding from your device.';
  } else if (reachableCount === 0) {
    verdict = 'Your connection is up, but none of the checked services responded — they may be blocked or down.';
  } else {
    const downNames = services.filter((r) => !r.reachable).map((r) => r.name);
    verdict = `Your connection is working. Not responding: ${downNames.join(', ')}. That service may be down, or blocked on your network.`;
  }

  return { results, internetUp, reachableCount, totalServices, verdict };
}
