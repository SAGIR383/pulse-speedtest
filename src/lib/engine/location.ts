import type { LocationInfo, ServerInfo } from '../engine/types';

/**
 * Location detection.
 *
 * Order of preference:
 *  1. Browser Geolocation API (precise GPS, requires permission).
 *  2. Free IP geolocation fallback (no key required) for an approximate fix.
 *
 * Reverse geocoding of GPS coordinates uses the free OpenStreetMap Nominatim
 * service (fair-use, no key). All calls fail gracefully.
 */

const haversineKm = (a: { lat: number; lng: number }, b: { lat: number; lng: number }): number => {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
};

async function reverseGeocode(lat: number, lng: number): Promise<Partial<LocationInfo>> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=10&addressdetails=1`,
      { headers: { 'Accept-Language': 'en' } },
    );
    const data = await res.json();
    const a = data.address ?? {};
    return {
      city: a.city ?? a.town ?? a.village ?? a.county ?? null,
      region: a.state ?? a.region ?? null,
      country: a.country ?? null,
    };
  } catch {
    return {};
  }
}

async function ipFallback(): Promise<LocationInfo | null> {
  // ipapi.co free tier — no API key required, returns coarse city-level location + ISP.
  try {
    const res = await fetch('https://ipapi.co/json/');
    if (!res.ok) throw new Error('ip lookup failed');
    const d = await res.json();
    if (typeof d.latitude !== 'number') return null;
    return {
      lat: d.latitude,
      lng: d.longitude,
      city: d.city ?? null,
      region: d.region ?? null,
      country: d.country_name ?? null,
      source: 'ip',
      accuracyM: null,
    };
  } catch {
    return null;
  }
}

export async function detectIsp(): Promise<string | null> {
  try {
    const res = await fetch('https://ipapi.co/json/');
    if (!res.ok) return null;
    const d = await res.json();
    return d.org ?? d.asn ?? null;
  } catch {
    return null;
  }
}

export function getGpsLocation(timeoutMs = 8000): Promise<LocationInfo | null> {
  return new Promise((resolve) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      resolve(null);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        const geo = await reverseGeocode(latitude, longitude);
        resolve({
          lat: latitude,
          lng: longitude,
          city: geo.city ?? null,
          region: geo.region ?? null,
          country: geo.country ?? null,
          source: 'gps',
          accuracyM: accuracy ?? null,
        });
      },
      () => resolve(null), // permission denied or error -> fall back to IP
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 60000 },
    );
  });
}

export async function detectLocation(): Promise<LocationInfo | null> {
  const gps = await getGpsLocation();
  if (gps) return gps;
  return ipFallback();
}

/**
 * Build a synthetic set of nearby "server nodes" around the user for the
 * map visualization. These are visual reference points; the actual test
 * always runs against the app's own same-origin endpoints (free + reliable).
 */
export function buildNearbyNodes(loc: LocationInfo | null): ServerInfo[] {
  const base = loc ?? { lat: 26.7271, lng: 88.3953 }; // sensible default
  const offsets = [
    { dlat: 0.0, dlng: 0.0, label: 'Edge · Local' },
    { dlat: 0.35, dlng: 0.42, label: 'Regional North' },
    { dlat: -0.4, dlng: 0.3, label: 'Regional South' },
    { dlat: 0.15, dlng: -0.5, label: 'Metro West' },
    { dlat: -0.25, dlng: -0.35, label: 'Metro East' },
  ];
  return offsets.map((o, i) => {
    const lat = base.lat + o.dlat;
    const lng = base.lng + o.dlng;
    return {
      id: `node_${i}`,
      label: o.label,
      url: '/api',
      lat,
      lng,
      distanceKm: Math.round(haversineKm(base, { lat, lng }) * 10) / 10,
    };
  });
}

export function pickBestServer(nodes: ServerInfo[]): ServerInfo {
  return nodes[0]; // the local edge node — same-origin endpoints
}
