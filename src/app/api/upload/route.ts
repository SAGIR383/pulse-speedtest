import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

/**
 * Upload sink endpoint.
 *
 * Drains the incoming request body (counting bytes) and replies immediately.
 * The client measures upload throughput from how fast it can push these POSTs.
 * We never store the data — it's read and discarded.
 */
export async function POST(req: NextRequest) {
  let received = 0;
  try {
    const reader = req.body?.getReader();
    if (reader) {
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) received += value.byteLength;
      }
    } else {
      const buf = await req.arrayBuffer();
      received = buf.byteLength;
    }
  } catch {
    // Client may abort mid-stream at end of phase — that's expected.
  }

  return new NextResponse(JSON.stringify({ received }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
      'Timing-Allow-Origin': '*',
      'Access-Control-Allow-Origin': '*',
    },
  });
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'content-type, x-pulse-probe',
    },
  });
}
