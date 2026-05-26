import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

/**
 * Download endpoint.
 *
 * Streams random, incompressible bytes so the client can measure real
 * download throughput. We cap the size for safety and stream in chunks so
 * memory stays flat regardless of payload size.
 *
 * Random data is critical: zero-filled buffers get compressed by proxies/CDNs
 * and would massively inflate the measured speed.
 */

const MAX_BYTES = 100 * 1024 * 1024; // 100 MB hard cap
const CHUNK = 64 * 1024; // 64 KB per stream chunk

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const requested = parseInt(searchParams.get('bytes') ?? '', 10);
  const total = Number.isFinite(requested)
    ? Math.min(Math.max(requested, CHUNK), MAX_BYTES)
    : 12 * 1024 * 1024;

  // Pre-fill one reusable random chunk; randomize a slice each emit so the
  // payload stays incompressible without re-randomizing the whole buffer.
  const chunk = new Uint8Array(CHUNK);
  crypto.getRandomValues(chunk);

  let sent = 0;
  const stream = new ReadableStream({
    pull(controller) {
      if (sent >= total) {
        controller.close();
        return;
      }
      const remaining = total - sent;
      const size = Math.min(CHUNK, remaining);
      // Rotate a small random window to defeat compression cheaply.
      const view = size === CHUNK ? chunk : chunk.subarray(0, size);
      // Lightly mutate to avoid any chunk-level dedup.
      view[0] = (view[0] + 1) & 0xff;
      controller.enqueue(view);
      sent += size;
    },
  });

  return new NextResponse(stream, {
    status: 200,
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Length': String(total),
      'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
      'Timing-Allow-Origin': '*',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
