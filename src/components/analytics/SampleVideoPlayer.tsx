'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Icon from '@/components/ui/Icon';

/**
 * SampleVideoPlayer — lets the user watch a nature sample clip at a chosen
 * resolution INSIDE the app, to feel their connection in action.
 *
 * HONEST NOTE ON RESOLUTION: YouTube's embed lets us *request* a starting
 * quality (vq= / suggestedQuality), but YouTube's player ultimately adapts to
 * the connection and may override the request. So buttons request the chosen
 * tier and the clip is labelled a "sample"; the user can also use the player's
 * own quality gear to force a level. We never claim hard-locked resolution.
 *
 * The video is served by YouTube (free, no hosting cost), but plays embedded in
 * Pulse rather than navigating away.
 */

interface Tier {
  res: string;
  label: string;
  vq: string; // YouTube quality hint
}

const TIERS: Tier[] = [
  { res: '720p', label: '720p HD', vq: 'hd720' },
  { res: '1080p', label: '1080p', vq: 'hd1080' },
  { res: '1440p', label: '1440p', vq: 'hd1440' },
  { res: '4K', label: '4K UHD', vq: 'hd2160' },
];

// A nature/landscape clip available up to 4K. (Royalty-free style demo content.)
// Using youtube-nocookie for a privacy-friendlier embed.
const VIDEO_ID = 'LXb3EKWsInQ'; // "Costa Rica in 4K" style nature demo

function embedUrl(vq: string): string {
  const params = new URLSearchParams({
    autoplay: '1',
    vq, // requested quality
    rel: '0',
    modestbranding: '1',
    playsinline: '1',
  });
  return `https://www.youtube-nocookie.com/embed/${VIDEO_ID}?${params.toString()}`;
}

export default function SampleVideoPlayer({
  maxSupported,
}: {
  /** Highest comfortably-supported resolution, used to highlight the recommended button. */
  maxSupported?: string;
}) {
  const [active, setActive] = useState<Tier | null>(null);

  return (
    <div>
      <p className="text-xs text-titanium-400 mb-3">
        Watch a sample nature clip in-app to see your connection in action:
      </p>
      <div className="flex flex-wrap gap-2.5">
        {TIERS.map((t) => {
          const isRec = maxSupported === t.res;
          const isActive = active?.res === t.res;
          return (
            <button
              key={t.res}
              onClick={() => setActive(t)}
              className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-transform hover:scale-[1.03] active:scale-95 ${
                isActive
                  ? 'bg-gradient-to-r from-aurora-cyan to-aurora-ice text-on-accent'
                  : isRec
                    ? 'bg-aurora-cyan/15 text-aurora-cyan'
                    : 'surface text-titanium-200 hover:text-titanium-100'
              }`}
            >
              <Icon name="play" size={13} />
              {t.label}
            </button>
          );
        })}
      </div>

      <AnimatePresence>
        {active && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="mt-4">
              <div className="relative w-full overflow-hidden rounded-xl bg-black" style={{ aspectRatio: '16 / 9' }}>
                <iframe
                  key={active.vq}
                  src={embedUrl(active.vq)}
                  title={`Sample nature clip — ${active.label}`}
                  className="absolute inset-0 h-full w-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
              <div className="mt-2 flex items-center justify-between">
                <p className="text-[11px] text-titanium-500">
                  Requesting {active.label}. YouTube may adapt quality to your live connection —
                  use the player&apos;s ⚙ gear to force a level.
                </p>
                <button
                  onClick={() => setActive(null)}
                  className="text-xs text-titanium-400 hover:text-titanium-100"
                >
                  Close
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
