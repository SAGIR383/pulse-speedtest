'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { INTERVAL_OPTIONS, type AutoTestSettings } from '@/lib/settings/autotest';
import {
  notificationPermission,
  requestNotificationPermission,
} from '@/lib/utils/notify';
import Icon from '@/components/ui/Icon';

/**
 * Monitor-mode control panel. Lets the user enable scheduled auto-testing,
 * pick an interval, and toggle drop alerts. Honest about the open-tab limit.
 */
export default function MonitorPanel({
  settings,
  update,
  nextRunAt,
}: {
  settings: AutoTestSettings;
  update: (patch: Partial<AutoTestSettings>) => void;
  nextRunAt: number | null;
}) {
  const [countdown, setCountdown] = useState<string>('');
  const [permState, setPermState] = useState<string>('default');

  useEffect(() => {
    setPermState(notificationPermission());
  }, []);

  useEffect(() => {
    if (!nextRunAt) {
      setCountdown('');
      return;
    }
    const tick = () => {
      const ms = nextRunAt - Date.now();
      if (ms <= 0) {
        setCountdown('now');
        return;
      }
      const m = Math.floor(ms / 60000);
      const s = Math.floor((ms % 60000) / 1000);
      setCountdown(`${m}:${String(s).padStart(2, '0')}`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [nextRunAt]);

  const toggleEnabled = async () => {
    const next = !settings.enabled;
    // If enabling with alerts on, request notification permission up front.
    if (next && settings.notifyOnDrop) {
      await requestNotificationPermission();
      setPermState(notificationPermission());
    }
    update({ enabled: next });
  };

  return (
    <div className="surface rounded-2xl p-5 sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 text-aurora-cyan">
            <Icon name="activity" size={18} />
          </span>
          <div>
            <h3 className="text-sm font-medium text-titanium-100">Monitor mode</h3>
            <p className="text-xs text-titanium-400 mt-1 max-w-md">
              Automatically re-test on a schedule to track how your connection behaves over
              time. Runs while Pulse stays open in this tab.
            </p>
          </div>
        </div>
        <button
          onClick={toggleEnabled}
          role="switch"
          aria-checked={settings.enabled}
          className={`relative h-6 w-11 flex-shrink-0 rounded-full transition-colors ${
            settings.enabled ? 'bg-aurora-cyan' : 'bg-white/15'
          }`}
        >
          <motion.span
            className="absolute top-0.5 h-5 w-5 rounded-full bg-white shadow"
            animate={{ left: settings.enabled ? '22px' : '2px' }}
            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
          />
        </button>
      </div>

      <AnimatePresence>
        {settings.enabled && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="pt-5 space-y-4">
              <div>
                <span className="text-[11px] uppercase tracking-wider text-titanium-400">Test every</span>
                <div className="mt-2 flex flex-wrap gap-2">
                  {INTERVAL_OPTIONS.map((min) => (
                    <button
                      key={min}
                      onClick={() => update({ intervalMin: min })}
                      className={`rounded-full px-4 py-1.5 text-sm transition-colors ${
                        settings.intervalMin === min
                          ? 'bg-aurora-cyan text-on-accent font-medium'
                          : 'bg-white/[0.05] text-titanium-300 hover:bg-white/10'
                      }`}
                    >
                      {min < 60 ? `${min} min` : '1 hr'}
                    </button>
                  ))}
                </div>
              </div>

              <label className="flex items-center justify-between">
                <span className="text-sm text-titanium-200">Alert me on a sharp drop</span>
                <button
                  onClick={() => update({ notifyOnDrop: !settings.notifyOnDrop })}
                  role="switch"
                  aria-checked={settings.notifyOnDrop}
                  className={`relative h-5 w-9 rounded-full transition-colors ${
                    settings.notifyOnDrop ? 'bg-aurora-mint' : 'bg-white/15'
                  }`}
                >
                  <motion.span
                    className="absolute top-0.5 h-4 w-4 rounded-full bg-white"
                    animate={{ left: settings.notifyOnDrop ? '18px' : '2px' }}
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                  />
                </button>
              </label>

              {settings.notifyOnDrop && permState === 'denied' && (
                <p className="text-[11px] text-aurora-ember">
                  Notifications are blocked in your browser settings — alerts will show in-app only.
                </p>
              )}

              {countdown && (
                <div className="flex items-center gap-2 text-xs text-titanium-400">
                  <Icon name="clock" size={13} />
                  Next test in <span className="tabular text-titanium-200">{countdown}</span>
                </div>
              )}

              <p className="text-[11px] text-titanium-500 leading-relaxed">
                Note: browsers pause timers when a tab is fully closed, so monitoring runs only
                while Pulse is open. Install the app and keep it open for continuous monitoring.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
