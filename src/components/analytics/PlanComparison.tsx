'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  loadPlan,
  savePlan,
  hasPlan,
  planPercent,
  type PlanSettings,
} from '@/lib/settings/plan';
import type { TestResult } from '@/lib/engine/types';

/**
 * Shows how the measured speeds compare to the user's subscribed plan.
 * If no plan is set, shows a compact prompt to add one.
 */
export default function PlanComparison({ result }: { result: TestResult }) {
  const [plan, setPlan] = useState<PlanSettings>({ planDownload: 0, planUpload: 0, planLabel: '' });
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<PlanSettings>(plan);

  useEffect(() => {
    const p = loadPlan();
    setPlan(p);
    setDraft(p);
  }, []);

  const commit = () => {
    const cleaned: PlanSettings = {
      planDownload: Math.max(0, Number(draft.planDownload) || 0),
      planUpload: Math.max(0, Number(draft.planUpload) || 0),
      planLabel: draft.planLabel.trim().slice(0, 40),
    };
    savePlan(cleaned);
    setPlan(cleaned);
    setEditing(false);
  };

  const dlPct = planPercent(result.download, plan.planDownload);
  const ulPct = planPercent(result.upload, plan.planUpload);

  const barColor = (pct: number) =>
    pct >= 80 ? '#7affc4' : pct >= 50 ? '#7cc6ff' : '#ff9d7a';

  if (editing) {
    return (
      <div className="surface rounded-2xl p-5 sm:p-6">
        <h3 className="text-sm font-medium text-titanium-100 mb-4">Your internet plan</h3>
        <div className="grid grid-cols-2 gap-4">
          <label className="block">
            <span className="text-[11px] uppercase tracking-wider text-titanium-400">Plan download (Mbps)</span>
            <input
              type="number"
              inputMode="numeric"
              value={draft.planDownload || ''}
              onChange={(e) => setDraft({ ...draft, planDownload: Number(e.target.value) })}
              placeholder="e.g. 100"
              className="mt-1 w-full rounded-lg bg-white/[0.04] border border-white/10 px-3 py-2 text-titanium-100 text-sm outline-none focus:border-aurora-cyan/50"
            />
          </label>
          <label className="block">
            <span className="text-[11px] uppercase tracking-wider text-titanium-400">Plan upload (Mbps)</span>
            <input
              type="number"
              inputMode="numeric"
              value={draft.planUpload || ''}
              onChange={(e) => setDraft({ ...draft, planUpload: Number(e.target.value) })}
              placeholder="e.g. 50"
              className="mt-1 w-full rounded-lg bg-white/[0.04] border border-white/10 px-3 py-2 text-titanium-100 text-sm outline-none focus:border-aurora-cyan/50"
            />
          </label>
        </div>
        <label className="block mt-4">
          <span className="text-[11px] uppercase tracking-wider text-titanium-400">Plan name (optional)</span>
          <input
            type="text"
            value={draft.planLabel}
            onChange={(e) => setDraft({ ...draft, planLabel: e.target.value })}
            placeholder="e.g. Jio Fiber 100"
            className="mt-1 w-full rounded-lg bg-white/[0.04] border border-white/10 px-3 py-2 text-titanium-100 text-sm outline-none focus:border-aurora-cyan/50"
          />
        </label>
        <div className="flex gap-3 mt-5">
          <button
            onClick={commit}
            className="rounded-full bg-gradient-to-r from-aurora-cyan to-aurora-ice px-5 py-2 text-sm font-medium text-void"
          >
            Save plan
          </button>
          <button
            onClick={() => { setDraft(plan); setEditing(false); }}
            className="rounded-full px-5 py-2 text-sm text-titanium-300 hover:text-titanium-100"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  if (!hasPlan(plan)) {
    return (
      <button
        onClick={() => setEditing(true)}
        className="surface w-full rounded-2xl p-5 text-left transition-colors hover:bg-white/[0.05]"
      >
        <p className="text-sm font-medium text-titanium-100">Compare to your plan</p>
        <p className="text-xs text-titanium-400 mt-1">
          Add your subscribed speed to see what % of your plan you&apos;re actually getting.
        </p>
      </button>
    );
  }

  return (
    <div className="surface rounded-2xl p-5 sm:p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-titanium-100">
          vs your plan{plan.planLabel ? ` · ${plan.planLabel}` : ''}
        </h3>
        <button
          onClick={() => { setDraft(plan); setEditing(true); }}
          className="text-xs text-titanium-400 hover:text-aurora-cyan"
        >
          Edit
        </button>
      </div>
      <div className="space-y-4">
        {dlPct !== null && (
          <PlanBar label="Download" actual={result.download} plan={plan.planDownload} pct={dlPct} color={barColor(dlPct)} />
        )}
        {ulPct !== null && (
          <PlanBar label="Upload" actual={result.upload} plan={plan.planUpload} pct={ulPct} color={barColor(ulPct)} />
        )}
      </div>
    </div>
  );
}

function PlanBar({
  label,
  actual,
  plan,
  pct,
  color,
}: {
  label: string;
  actual: number;
  plan: number;
  pct: number;
  color: string;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between mb-1.5">
        <span className="text-xs text-titanium-300">{label}</span>
        <span className="text-sm font-medium" style={{ color }}>
          {pct}% <span className="text-titanium-400 font-normal">of {plan} Mbps</span>
        </span>
      </div>
      <div className="h-2 rounded-full bg-white/[0.06] overflow-hidden">
        <motion.div
          className="h-full rounded-full"
          style={{ background: color }}
          initial={{ width: 0 }}
          animate={{ width: `${Math.min(100, pct)}%` }}
          transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
        />
      </div>
      <p className="text-[11px] text-titanium-500 mt-1">
        Measured {actual.toFixed(1)} Mbps
        {pct < 50 ? ' — well below your plan' : pct < 80 ? ' — a bit under your plan' : ' — close to your plan'}
      </p>
    </div>
  );
}
