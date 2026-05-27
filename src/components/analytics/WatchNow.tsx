'use client';

import { motion } from 'framer-motion';
import type { StreamingTier } from '@/lib/engine/types';
import Icon from '@/components/ui/Icon';
import SampleVideoPlayer from '@/components/analytics/SampleVideoPlayer';

/**
 * WatchNow — turns the streaming-capability analysis into an actionable
 * recommendation. It identifies the highest resolution the connection can
 * stream *comfortably* (with headroom, not just barely), states it in plain
 * language, and offers one-tap links to go watch at that quality.
 *
 * "Comfortably" = at least 1.3x the required bandwidth, so we don't recommend a
 * tier the user will actually see buffer. Falls back to the highest merely-
 * supported tier if nothing clears the comfort bar.
 */

const COMFORT_MARGIN = 1.3;

function pickRecommended(tiers: StreamingTier[]): StreamingTier | null {
  // Highest tier the user clears comfortably.
  const comfortable = [...tiers].reverse().find((t) => t.margin >= COMFORT_MARGIN);
  if (comfortable) return comfortable;
  // Otherwise the highest merely-supported tier.
  const supported = [...tiers].reverse().find((t) => t.supported);
  return supported ?? null;
}

export default function WatchNow({
  tiers,
  download,
}: {
  tiers: StreamingTier[];
  download: number;
}) {
  const rec = pickRecommended(tiers);

  // Build a friendly headline based on the recommended resolution.
  let headline: string;
  let sub: string;
  let canStream = true;

  if (!rec) {
    canStream = false;
    headline = 'Streaming may buffer right now';
    sub = `At ${download.toFixed(1)} Mbps, even SD video could struggle. Try moving closer to your router.`;
  } else if (rec.resolution === '2160p') {
    headline = 'You can stream 4K right now';
    sub = `${download.toFixed(1)} Mbps comfortably handles 4K UHD — even on more than one screen.`;
  } else if (rec.resolution === '1440p') {
    headline = 'You can stream up to 1440p (QHD)';
    sub = `${download.toFixed(1)} Mbps is smooth at 1440p. Single-device 4K is borderline.`;
  } else if (rec.resolution === '1080p') {
    headline = 'You can stream Full HD (1080p)';
    sub = `${download.toFixed(1)} Mbps plays 1080p smoothly. Higher resolutions may buffer.`;
  } else if (rec.resolution === '720p') {
    headline = 'You can stream HD (720p)';
    sub = `${download.toFixed(1)} Mbps is reliable at 720p. 1080p may occasionally buffer.`;
  } else {
    headline = `You can stream up to ${rec.resolution}`;
    sub = `${download.toFixed(1)} Mbps supports ${rec.resolution}. Higher resolutions will buffer.`;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="surface rounded-2xl p-5 sm:p-6"
    >
      <div className="flex items-start gap-4">
        <div className="mt-0.5 flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-aurora-cyan/20 to-aurora-violet/20 text-aurora-cyan">
          <Icon name="video" size={20} />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-medium text-titanium-100">{headline}</h3>
          <p className="mt-1 text-sm leading-relaxed text-titanium-300">{sub}</p>

          {/* Resolution ladder — quick visual of what's comfortable */}
          <div className="mt-4 flex flex-wrap gap-2">
            {tiers
              .filter((t) => ['720p', '1080p', '1440p', '2160p'].includes(t.resolution))
              .map((t) => {
                const comfortable = t.margin >= COMFORT_MARGIN;
                const ok = t.supported;
                const isRec = rec?.resolution === t.resolution;
                const labelMap: Record<string, string> = {
                  '720p': '720p HD',
                  '1080p': '1080p',
                  '1440p': '1440p',
                  '2160p': '4K',
                };
                return (
                  <span
                    key={t.resolution}
                    className={`rounded-full px-3 py-1 text-xs font-medium ${
                      isRec
                        ? 'bg-aurora-cyan text-on-accent'
                        : comfortable
                          ? 'bg-aurora-mint/15 text-aurora-mint'
                          : ok
                            ? 'bg-aurora-ember/15 text-aurora-ember'
                            : 'bg-white/[0.05] text-titanium-500'
                    }`}
                    title={
                      comfortable
                        ? 'Streams smoothly'
                        : ok
                          ? 'Supported but may buffer'
                          : 'Not enough bandwidth'
                    }
                  >
                    {comfortable ? '✓ ' : ok ? '~ ' : '✕ '}
                    {labelMap[t.resolution]}
                  </span>
                );
              })}
          </div>

          {/* In-app sample video player at selectable resolutions */}
          {canStream && (
            <div className="mt-5">
              <SampleVideoPlayer maxSupported={rec?.resolution === '2160p' ? '4K' : rec?.resolution} />
            </div>
          )}

          <p className="mt-3 text-[11px] text-titanium-500">
            Tip: streaming apps auto-pick quality — set it manually to your recommended resolution for the best picture.
          </p>
        </div>
      </div>
    </motion.div>
  );
}
