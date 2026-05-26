import { NextResponse } from 'next/server';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

/**
 * Ping endpoint.
 * Replies instantly with a 1-byte body so the client measures pure RTT.
 * Aggressive no-cache headers ensure every probe hits the network.
 */
export async function GET() {
  return new NextResponse('1', {
    status: 200,
    headers: {
      'Content-Type': 'text/plain',
      'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
      'Timing-Allow-Origin': '*',
      'Access-Control-Allow-Origin': '*',
    },
  });
}

export async function HEAD() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
      'Timing-Allow-Origin': '*',
    },
  });
}
