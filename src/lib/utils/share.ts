'use client';

import type { TestResult } from '@/lib/engine/types';

/**
 * Export & share helpers.
 *  - exportHistoryCsv: download the full test history as a CSV file.
 *  - buildShareCard:   render a result into a branded PNG (canvas) for sharing.
 */

export function exportHistoryCsv(results: TestResult[]): void {
  if (typeof window === 'undefined' || results.length === 0) return;

  const header = [
    'Date',
    'Time',
    'Download (Mbps)',
    'Upload (Mbps)',
    'Ping (ms)',
    'Jitter (ms)',
    'Packet Loss (%)',
    'Health',
    'ISP',
    'Location',
  ];

  const rows = results.map((r) => {
    const d = new Date(r.timestamp);
    const loc = r.location
      ? [r.location.city, r.location.region, r.location.country].filter(Boolean).join(' ')
      : '';
    return [
      d.toLocaleDateString(),
      d.toLocaleTimeString(),
      r.download.toFixed(2),
      r.upload.toFixed(2),
      r.ping.toFixed(1),
      r.jitter.toFixed(1),
      r.packetLoss.toFixed(1),
      String(r.healthScore),
      csvEscape(r.isp ?? ''),
      csvEscape(loc),
    ].join(',');
  });

  const csv = [header.join(','), ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `pulse-history-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function csvEscape(s: string): string {
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/**
 * Render a shareable result card to a PNG blob using an offscreen canvas.
 * Returns a Blob (for the Web Share API) and a data URL (for download fallback).
 */
export async function buildShareCard(
  result: TestResult,
  healthScore: number,
  headline: string
): Promise<{ blob: Blob | null; dataUrl: string }> {
  const W = 1080;
  const H = 1080;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return { blob: null, dataUrl: '' };

  // Background
  ctx.fillStyle = '#05060a';
  ctx.fillRect(0, 0, W, H);

  // Ambient radial glows
  const glow = (x: number, y: number, r: number, color: string, a: number) => {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, color);
    g.addColorStop(1, 'rgba(5,6,10,0)');
    ctx.globalAlpha = a;
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = 1;
  };
  glow(220, 200, 520, '#5ee7e0', 0.14);
  glow(900, 260, 460, '#9d8cff', 0.16);
  glow(540, 1000, 600, '#7cc6ff', 0.1);

  // Brand
  ctx.fillStyle = '#f3f5fb';
  ctx.font = '600 52px Sora, system-ui, sans-serif';
  ctx.fillText('Pulse', 80, 130);
  ctx.fillStyle = '#5f6781';
  ctx.font = '500 22px Manrope, system-ui, sans-serif';
  ctx.fillText('NETWORK INTELLIGENCE', 82, 168);

  // Health ring
  const cx = W / 2;
  const cy = 420;
  const radius = 150;
  ctx.lineWidth = 22;
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.stroke();
  const grad = ctx.createLinearGradient(cx - radius, cy - radius, cx + radius, cy + radius);
  grad.addColorStop(0, '#5ee7e0');
  grad.addColorStop(1, '#9d8cff');
  ctx.strokeStyle = grad;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(cx, cy, radius, -Math.PI / 2, -Math.PI / 2 + (healthScore / 100) * Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = '#f3f5fb';
  ctx.textAlign = 'center';
  ctx.font = '300 110px Sora, system-ui, sans-serif';
  ctx.fillText(String(healthScore), cx, cy + 30);
  ctx.fillStyle = '#5f6781';
  ctx.font = '500 24px Manrope, system-ui, sans-serif';
  ctx.fillText('HEALTH', cx, cy + 78);

  // Headline
  ctx.fillStyle = '#dfe3ee';
  ctx.font = '600 40px Sora, system-ui, sans-serif';
  ctx.fillText(headline, cx, cy + 200);

  // Metrics row
  const metrics: [string, string, string][] = [
    ['DOWNLOAD', fmt(result.download), 'Mbps'],
    ['UPLOAD', fmt(result.upload), 'Mbps'],
    ['PING', result.ping.toFixed(0), 'ms'],
    ['JITTER', result.jitter.toFixed(1), 'ms'],
  ];
  const colW = W / 4;
  const my = 820;
  metrics.forEach(([label, val, unit], i) => {
    const x = colW * i + colW / 2;
    ctx.fillStyle = '#5f6781';
    ctx.font = '600 22px Manrope, system-ui, sans-serif';
    ctx.fillText(label, x, my - 60);
    ctx.fillStyle = '#f3f5fb';
    ctx.font = '300 64px Sora, system-ui, sans-serif';
    ctx.fillText(val, x, my + 10);
    ctx.fillStyle = '#8b94ad';
    ctx.font = '500 24px Manrope, system-ui, sans-serif';
    ctx.fillText(unit, x, my + 48);
  });

  // ISP / location footer
  const footerParts = [
    result.isp ?? '',
    result.location
      ? [result.location.city, result.location.country].filter(Boolean).join(', ')
      : '',
  ].filter(Boolean);
  ctx.fillStyle = '#5f6781';
  ctx.font = '500 26px Manrope, system-ui, sans-serif';
  ctx.fillText(footerParts.join('  •  '), cx, 980);
  ctx.fillStyle = '#454c63';
  ctx.font = '500 22px Manrope, system-ui, sans-serif';
  ctx.fillText(new Date(result.timestamp).toLocaleString(), cx, 1020);

  ctx.textAlign = 'left';

  const dataUrl = canvas.toDataURL('image/png');
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob((b) => resolve(b), 'image/png')
  );
  return { blob, dataUrl };
}

function fmt(mbps: number): string {
  if (mbps >= 1000) return (mbps / 1000).toFixed(2);
  return mbps >= 100 ? mbps.toFixed(0) : mbps.toFixed(1);
}

/** Trigger share (Web Share API) or fall back to downloading the PNG. */
export async function shareResultCard(
  result: TestResult,
  healthScore: number,
  headline: string
): Promise<void> {
  const { blob, dataUrl } = await buildShareCard(result, healthScore, headline);

  if (blob && navigator.canShare) {
    const file = new File([blob], 'pulse-result.png', { type: 'image/png' });
    if (navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({
          files: [file],
          title: 'My Pulse speed test',
          text: `Download ${fmt(result.download)} Mbps · Upload ${fmt(result.upload)} Mbps · Ping ${result.ping.toFixed(0)}ms`,
        });
        return;
      } catch {
        /* user cancelled or share failed — fall through to download */
      }
    }
  }

  // Fallback: download the image.
  if (dataUrl) {
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = 'pulse-result.png';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }
}
