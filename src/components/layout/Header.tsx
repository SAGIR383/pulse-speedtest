'use client';

import { motion } from 'framer-motion';
import type { LocationInfo } from '@/lib/engine/types';
import Icon from '@/components/ui/Icon';
import ThemeToggle from '@/components/layout/ThemeToggle';

interface HeaderProps {
  view: 'test' | 'history';
  setView: (v: 'test' | 'history') => void;
  location: LocationInfo | null;
  isp: string | null;
}

export default function Header({ view, setView, location, isp }: HeaderProps) {
  return (
    <header className="w-full max-w-5xl mx-auto px-5 sm:px-6 pt-6 pb-4 flex items-center justify-between gap-4">
      {/* Brand */}
      <div className="flex items-center gap-3">
        <div className="relative h-9 w-9">
          <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-aurora-cyan to-aurora-violet opacity-90 blur-[2px]" />
          <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-aurora-cyan/80 to-aurora-violet/80 flex items-center justify-center">
            <span className="text-void font-display font-semibold text-lg">P</span>
          </div>
        </div>
        <div className="leading-none">
          <div className="font-display font-semibold tracking-wide text-titanium-100">Pulse</div>
          <div className="text-[10px] uppercase tracking-[0.2em] text-titanium-400">Network Intelligence</div>
        </div>
      </div>

      {/* View toggle */}
      <div className="flex items-center gap-1 surface rounded-full p-1">
        {(['test', 'history'] as const).map((v) => (
          <button
            key={v}
            onClick={() => setView(v)}
            className="relative px-4 py-1.5 rounded-full text-xs font-medium tracking-wide transition-colors"
          >
            {view === v && (
              <motion.span
                layoutId="viewPill"
                className="absolute inset-0 rounded-full bg-white/10"
                transition={{ type: 'spring', stiffness: 380, damping: 30 }}
              />
            )}
            <span className={`relative z-10 capitalize ${view === v ? 'text-titanium-100' : 'text-titanium-400'}`}>
              {v}
            </span>
          </button>
        ))}
      </div>

      {/* Right side: location chip + theme toggle */}
      <div className="flex items-center gap-2">
        <div className="hidden md:flex items-center gap-2 text-xs text-titanium-300 surface rounded-full px-3 py-1.5 max-w-[200px]">
          <span className="text-aurora-cyan shrink-0"><Icon name="globe" size={13} /></span>
          <span className="truncate">
            {location?.city ?? isp ?? 'Detecting…'}
          </span>
        </div>
        <ThemeToggle />
      </div>
    </header>
  );
}
