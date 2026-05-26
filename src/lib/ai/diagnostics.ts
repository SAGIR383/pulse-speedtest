import type { TestResult, Diagnostics, InsightCard, StreamingTier, Verdict } from '../engine/types';
import {
  computeHealthScore,
  scorePing,
  scoreJitter,
  scorePacketLoss,
} from './score';

/**
 * Local, rule-based "AI" diagnostics engine.
 *
 * Translates raw metrics into the human questions users actually ask:
 *  - Is my internet good?
 *  - Can I stream 4K?
 *  - Can I game smoothly?
 *  - Will Zoom work?
 *  - Why is my WiFi slow?
 *
 * Everything here is heuristic + scoring; no network calls, no paid models.
 */

const verdictFromScore = (s: number): Verdict =>
  s >= 85 ? 'excellent' : s >= 65 ? 'good' : s >= 40 ? 'fair' : 'poor';

/* ---------- Streaming ---------- */

const STREAM_TIERS: Omit<StreamingTier, 'supported' | 'margin'>[] = [
  { label: 'SD', resolution: '480p', requiredMbps: 3 },
  { label: 'HD', resolution: '720p', requiredMbps: 5 },
  { label: 'Full HD', resolution: '1080p', requiredMbps: 8 },
  { label: 'QHD', resolution: '1440p', requiredMbps: 16 },
  { label: '4K UHD', resolution: '2160p', requiredMbps: 25 },
];

function analyzeStreaming(download: number): StreamingTier[] {
  return STREAM_TIERS.map((t) => ({
    ...t,
    supported: download >= t.requiredMbps,
    margin: t.requiredMbps > 0 ? Math.round((download / t.requiredMbps) * 10) / 10 : 0,
  }));
}

/* ---------- Gaming ---------- */

function analyzeGaming(r: TestResult): InsightCard {
  const pScore = scorePing(r.ping);
  const jScore = scoreJitter(r.jitter);
  const lScore = scorePacketLoss(r.packetLoss);
  // Gaming is dominated by latency stability, not raw bandwidth.
  const score = Math.round(pScore * 0.45 + jScore * 0.35 + lScore * 0.2);
  const verdict = verdictFromScore(score);

  let summary: string;
  let detail: string;
  if (verdict === 'excellent') {
    summary = 'Excellent for competitive gaming';
    detail = `Low ${r.ping}ms ping with tight ${r.jitter}ms jitter — fast-paced multiplayer and ranked play will feel responsive.`;
  } else if (verdict === 'good') {
    summary = 'Stable for online multiplayer';
    detail = `${r.ping}ms ping is solid for most games. Competitive shooters may occasionally feel a half-step behind.`;
  } else if (verdict === 'fair') {
    summary = 'Casual gaming only';
    detail = `Latency (${r.ping}ms) or jitter (${r.jitter}ms) is high enough to cause noticeable lag spikes in fast games.`;
  } else {
    summary = 'Competitive gaming may suffer';
    detail = `High latency/jitter and ${r.packetLoss}% loss will likely cause rubber-banding and dropped inputs.`;
  }

  return { id: 'gaming', title: 'Gaming', verdict, summary, detail, score, icon: 'gamepad' };
}

/* ---------- Video calls ---------- */

function analyzeVideoCalls(r: TestResult): InsightCard {
  const upScore = r.upload >= 3 ? 100 : r.upload >= 1.5 ? 70 : r.upload >= 0.8 ? 45 : 20;
  const pScore = scorePing(r.ping);
  const jScore = scoreJitter(r.jitter);
  const lScore = scorePacketLoss(r.packetLoss);
  const score = Math.round(upScore * 0.35 + pScore * 0.2 + jScore * 0.25 + lScore * 0.2);
  const verdict = verdictFromScore(score);

  let summary: string;
  let detail: string;
  if (verdict === 'excellent') {
    summary = 'Crystal-clear video calls';
    detail = `${r.upload} Mbps upload with stable latency handles HD Zoom, Meet, Teams and Discord without artifacts.`;
  } else if (verdict === 'good') {
    summary = 'Reliable for HD video calls';
    detail = `Upload of ${r.upload} Mbps is comfortable for one-on-one and small group calls.`;
  } else if (verdict === 'fair') {
    summary = 'Calls may degrade under load';
    detail = `Limited upload (${r.upload} Mbps) or jitter (${r.jitter}ms) can cause frozen frames when sharing screen.`;
  } else {
    summary = 'Video calls likely to struggle';
    detail = `Low upload and unstable latency will cause audio cut-outs and dropped video.`;
  }

  return { id: 'video', title: 'Video Calls', verdict, summary, detail, score, icon: 'video' };
}

/* ---------- Streaming card ---------- */

function analyzeStreamingCard(r: TestResult, tiers: StreamingTier[]): InsightCard {
  const top = [...tiers].reverse().find((t) => t.supported);
  const score = r.download >= 25 ? 95 : r.download >= 8 ? 78 : r.download >= 5 ? 60 : r.download >= 3 ? 42 : 18;
  const verdict = verdictFromScore(score);
  let summary: string;
  let detail: string;
  if (!top) {
    summary = 'Streaming will buffer';
    detail = `At ${r.download} Mbps even SD video may struggle on a shared connection.`;
  } else if (top.label === '4K UHD') {
    summary = 'Excellent for Netflix 4K';
    detail = `${r.download} Mbps comfortably supports 4K UHD streaming — even on multiple devices at once.`;
  } else if (top.label === 'QHD') {
    summary = 'Smooth up to 1440p';
    detail = `${r.download} Mbps handles 1440p easily; single-device 4K is borderline.`;
  } else if (top.label === 'Full HD') {
    summary = 'Smooth 1080p playback';
    detail = `${r.download} Mbps supports Full HD on YouTube and Netflix; Twitch high-bitrate may buffer.`;
  } else {
    summary = `Reliable up to ${top.resolution}`;
    detail = `${r.download} Mbps supports ${top.resolution}. Higher resolutions will buffer.`;
  }
  return { id: 'streaming', title: 'Streaming', verdict, summary, detail, score, icon: 'play' };
}

/* ---------- Stability ---------- */

function analyzeStability(r: TestResult): InsightCard {
  const jScore = scoreJitter(r.jitter);
  const lScore = scorePacketLoss(r.packetLoss);
  const spread = r.latency.max - r.latency.min;
  const spreadScore = spread <= 10 ? 100 : spread <= 30 ? 75 : spread <= 80 ? 45 : 20;
  const score = Math.round(jScore * 0.4 + lScore * 0.35 + spreadScore * 0.25);
  const verdict = verdictFromScore(score);
  let summary: string;
  if (verdict === 'excellent') summary = 'Rock-solid and consistent';
  else if (verdict === 'good') summary = 'Stable connection';
  else if (verdict === 'fair') summary = 'Occasionally unstable';
  else summary = 'Unstable — frequent fluctuations';
  const detail = `Jitter ${r.jitter}ms · packet loss ${r.packetLoss}% · latency range ${Math.round(spread)}ms.`;
  return { id: 'stability', title: 'Stability', verdict, summary, detail, score, icon: 'pulse' };
}

/* ---------- WiFi diagnostics & recommendations ---------- */

function buildRecommendations(r: TestResult): string[] {
  const recs: string[] = [];

  if (r.jitter > 15 || r.latency.max - r.latency.min > 60) {
    recs.push('High latency variation detected — move closer to your router or switch to the 5GHz band for a more stable signal.');
  }
  if (r.packetLoss > 1) {
    recs.push(`Packet loss of ${r.packetLoss}% suggests interference or congestion — restarting your router/modem often clears this.`);
  }
  if (r.upload < 5 && r.download > 30) {
    recs.push('Upload is much weaker than download — typical of cable/DSL plans. Use Ethernet for video calls and large uploads.');
  }
  if (r.ping > 80) {
    recs.push('Ping is high — your traffic may be routing far from you. For gaming, a wired connection or closer server helps.');
  }
  if (r.download < 25) {
    recs.push('Download below 25 Mbps can bottleneck 4K streaming and multi-device use — consider reducing connected devices during heavy use.');
  }
  if (recs.length === 0) {
    recs.push('Your connection looks healthy across the board — no action needed. Re-test periodically to catch ISP issues early.');
  }
  // Always-useful general tips capped to keep the list tight.
  if (r.healthScore < 65) {
    recs.push('For the most reliable experience on speed-critical tasks, prefer a wired Ethernet connection over WiFi.');
  }
  return recs.slice(0, 5);
}

/* ---------- Headline ---------- */

function buildHeadline(score: number, r: TestResult): { headline: string; summary: string } {
  if (score >= 85) {
    return {
      headline: 'Your internet is excellent',
      summary: `${r.download} Mbps down · ${r.upload} Mbps up · ${r.ping}ms ping. This connection handles everything from 4K streaming to competitive gaming with room to spare.`,
    };
  }
  if (score >= 65) {
    return {
      headline: 'Your internet is good',
      summary: `${r.download} Mbps down · ${r.upload} Mbps up · ${r.ping}ms ping. Comfortable for streaming, calls and everyday use, with minor limits under heavy load.`,
    };
  }
  if (score >= 40) {
    return {
      headline: 'Your internet is workable',
      summary: `${r.download} Mbps down · ${r.upload} Mbps up · ${r.ping}ms ping. Fine for browsing and HD video, but heavy or latency-sensitive tasks may struggle.`,
    };
  }
  return {
    headline: 'Your internet needs attention',
    summary: `${r.download} Mbps down · ${r.upload} Mbps up · ${r.ping}ms ping. You'll likely notice buffering, lag or dropped calls. See the recommendations below.`,
  };
}

/* ---------- Public API ---------- */

export function buildDiagnostics(r: TestResult): Diagnostics {
  const healthScore = r.healthScore || computeHealthScore(r);
  const streaming = analyzeStreaming(r.download);

  const cards: InsightCard[] = [
    analyzeStreamingCard(r, streaming),
    analyzeGaming(r),
    analyzeVideoCalls(r),
    analyzeStability(r),
  ];

  const { headline, summary } = buildHeadline(healthScore, r);

  return {
    healthScore,
    headline,
    summary,
    cards,
    streaming,
    recommendations: buildRecommendations(r),
  };
}
