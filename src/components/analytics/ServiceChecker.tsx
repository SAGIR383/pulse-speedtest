'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { checkServices, type ReachabilityReport } from '@/lib/engine/reachability';
import Icon from '@/components/ui/Icon';

/**
 * ServiceChecker — "Is it down, or is it me?" panel.
 * Probes popular services from the user's device and reports which respond.
 * Honest framing: reachability from this device, not authoritative status.
 */
export default function ServiceChecker() {
  const [report, setReport] = useState<ReachabilityReport | null>(null);
  const [checking, setChecking] = useState(false);
  const [progress, setProgress] = useState(0);

  const run = async () => {
    setChecking(true);
    setReport(null);
    setProgress(0);
    try {
      const r = await checkServices((done, total) => setProgress(Math.round((done / total) * 100)));
      setReport(r);
    } catch {
      /* network fully down — leave report null, the verdict below handles it */
    } finally {
      setChecking(false);
    }
  };

  const dot = (status: string) =>
    status === 'reachable' ? '#7affc4' : status === 'slow' ? '#ff9d7a' : '#ff6b6b';

  return (
    <div className="surface rounded-2xl p-5 sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 text-aurora-ice">
            <Icon name="globe" size={18} />
          </span>
          <div>
            <h3 className="text-sm font-medium text-titanium-100">Is it down, or is it me?</h3>
            <p className="mt-1 max-w-md text-xs text-titanium-400">
              Checks whether popular services respond from your device — so you know if an outage is
              the service or your connection.
            </p>
          </div>
        </div>
        <button
          onClick={run}
          disabled={checking}
          className="flex-shrink-0 rounded-full bg-gradient-to-r from-aurora-cyan to-aurora-ice px-4 py-2 text-sm font-medium text-on-accent transition-transform hover:scale-[1.03] active:scale-95 disabled:opacity-60"
        >
          {checking ? `Checking… ${progress}%` : report ? 'Re-check' : 'Check now'}
        </button>
      </div>

      <AnimatePresence>
        {report && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="pt-5">
              {/* Verdict */}
              <div
                className="rounded-xl px-4 py-3 text-sm"
                style={{
                  background:
                    report.reachableCount === report.totalServices
                      ? 'rgba(122,255,196,0.08)'
                      : report.reachableCount === 0
                        ? 'rgba(255,107,107,0.1)'
                        : 'rgba(255,157,122,0.08)',
                  color:
                    report.reachableCount === report.totalServices
                      ? '#7affc4'
                      : report.reachableCount === 0
                        ? '#ff6b6b'
                        : '#ff9d7a',
                }}
              >
                {report.verdict}
              </div>

              {/* Per-service grid */}
              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
                {report.results.map((r) => (
                  <div
                    key={r.id}
                    className="flex items-center justify-between rounded-lg bg-white/[0.03] px-3 py-2"
                  >
                    <div className="flex items-center gap-2.5">
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ background: dot(r.status), boxShadow: `0 0 8px ${dot(r.status)}` }}
                      />
                      <span className="text-sm text-titanium-200">{r.name}</span>
                      <span className="text-[10px] uppercase tracking-wider text-titanium-500">{r.category}</span>
                    </div>
                    <span className="text-xs tabular text-titanium-400">
                      {r.reachable ? (r.status === 'slow' ? `slow · ${r.ms}ms` : `${r.ms}ms`) : 'no response'}
                    </span>
                  </div>
                ))}
              </div>

              <p className="mt-3 text-[11px] leading-relaxed text-titanium-500">
                Note: browsers can&apos;t read other sites&apos; full status, so this measures whether each
                service <em>responds</em> to your device. &ldquo;No response&rdquo; can mean the service is down,
                unreachable, or blocked on your network.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
