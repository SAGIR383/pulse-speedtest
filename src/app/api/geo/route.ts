import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

/**
 * Server-side geolocation.
 *
 * Resolving location/ISP from the browser (e.g. ipapi.co directly) is fragile:
 * CORS blocks, rate limits, and ad-blockers frequently kill it — which is why
 * the client showed "unknown". Doing it here on the edge avoids all of that:
 *
 *  1. Hosting platforms (Vercel/Cloudflare) attach geo headers to every request
 *     based on the visitor's IP — instant, free, no external call.
 *  2. If those aren't present (e.g. local dev), fall back to a server-to-server
 *     IP lookup, which has no CORS restriction since it's not a browser call.
 *
 * The visitor's real IP is read from standard proxy headers.
 */

function clientIp(req: NextRequest): string | null {
  const xff = req.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim();
  return req.headers.get('x-real-ip');
}

export async function GET(req: NextRequest) {
  const h = req.headers;

  // 1) Platform-provided geo headers (Vercel sets x-vercel-ip-*; Cloudflare
  //    sets cf-ipcountry and exposes geo via request.cf, surfaced as headers).
  const city =
    h.get('x-vercel-ip-city') ??
    h.get('cf-ipcity') ??
    null;
  const region =
    h.get('x-vercel-ip-country-region') ??
    h.get('cf-region') ??
    null;
  const country =
    h.get('x-vercel-ip-country') ??
    h.get('cf-ipcountry') ??
    null;
  const latStr = h.get('x-vercel-ip-latitude');
  const lngStr = h.get('x-vercel-ip-longitude');

  const decodedCity = city ? decodeURIComponent(city) : null;

  let lat = latStr ? parseFloat(latStr) : NaN;
  let lng = lngStr ? parseFloat(lngStr) : NaN;
  let isp: string | null = null;
  let resolvedCountry = country;
  let resolvedRegion = region;
  let resolvedCity = decodedCity;

  // 2) Fallback: server-side IP lookup (no CORS — this is a server call).
  //    Also used to enrich ISP/ASN which platform headers don't include.
  if (!Number.isFinite(lat) || !isp) {
    try {
      const ip = clientIp(req);
      // ipwho.is is free, keyless, https, and CORS-irrelevant here.
      const url = ip ? `https://ipwho.is/${ip}` : 'https://ipwho.is/';
      const res = await fetch(url, { cache: 'no-store' });
      if (res.ok) {
        const d = await res.json();
        if (d && d.success !== false) {
          if (!Number.isFinite(lat) && typeof d.latitude === 'number') {
            lat = d.latitude;
            lng = d.longitude;
          }
          resolvedCity = resolvedCity ?? d.city ?? null;
          resolvedRegion = resolvedRegion ?? d.region ?? null;
          resolvedCountry = resolvedCountry ?? d.country ?? null;
          isp = d.connection?.isp ?? d.connection?.org ?? d.org ?? null;
        }
      }
    } catch {
      /* fall through with whatever we have */
    }
  }

  return NextResponse.json(
    {
      lat: Number.isFinite(lat) ? lat : null,
      lng: Number.isFinite(lng) ? lng : null,
      city: resolvedCity,
      region: resolvedRegion,
      country: resolvedCountry,
      isp,
      source: 'ip',
    },
    {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
      },
    },
  );
}
