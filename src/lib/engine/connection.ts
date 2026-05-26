'use client';

/**
 * Detect the device's connection type using the Network Information API.
 * Support is partial (good on Chrome/Android, absent on Safari/Firefox), so
 * this always degrades gracefully to 'unknown'.
 */

interface NetworkInformationLike {
  type?: string;
  effectiveType?: string;
  downlink?: number;
  rtt?: number;
}

export interface ConnectionInfo {
  /** 'wifi' | 'cellular' | 'ethernet' | 'unknown' */
  type: string;
  /** '4g' | '3g' | '2g' | 'slow-2g' | null — cellular generation estimate. */
  effectiveType: string | null;
  /** Browser's own downlink estimate in Mbps, or null. */
  downlink: number | null;
  label: string;
}

function getConnection(): NetworkInformationLike | null {
  if (typeof navigator === 'undefined') return null;
  const nav = navigator as Navigator & {
    connection?: NetworkInformationLike;
    mozConnection?: NetworkInformationLike;
    webkitConnection?: NetworkInformationLike;
  };
  return nav.connection ?? nav.mozConnection ?? nav.webkitConnection ?? null;
}

export function detectConnection(): ConnectionInfo {
  const c = getConnection();
  if (!c) {
    return { type: 'unknown', effectiveType: null, downlink: null, label: 'Connection' };
  }

  const rawType = (c.type ?? '').toLowerCase();
  let type = 'unknown';
  if (rawType === 'wifi') type = 'wifi';
  else if (rawType === 'cellular') type = 'cellular';
  else if (rawType === 'ethernet') type = 'ethernet';
  else if (rawType === 'wimax') type = 'cellular';

  const effectiveType = c.effectiveType ?? null;

  // When `type` isn't exposed (common), infer a friendly label from effectiveType.
  let label: string;
  if (type === 'wifi') label = 'Wi-Fi';
  else if (type === 'ethernet') label = 'Ethernet';
  else if (type === 'cellular') label = effectiveType ? `Cellular (${effectiveType.toUpperCase()})` : 'Cellular';
  else if (effectiveType) label = effectiveType.toUpperCase();
  else label = 'Connection';

  return {
    type,
    effectiveType,
    downlink: typeof c.downlink === 'number' ? c.downlink : null,
    label,
  };
}
