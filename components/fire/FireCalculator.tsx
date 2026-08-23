"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { formatCents, formatPercent } from "@/lib/money";
import { fireNumber, fireProgressPct, yearsToFire, projectionSeries } from "@/lib/fireMath";
import { Button } from "@/components/ui/Button";
import { FireProjectionChart } from "@/components/charts/FireProjectionChart";
import { cn } from "@/lib/cn";

export interface FireSettingsData {
  swr: string;
  expectedReturn: string;
  annualExpensesOverride: number | null;
  monthlyContributionOverride: number | null;
}

export function FireCalculator({
  investableNetWorth,
  defaultAnnualExpenses,
  defaultMonthlyContribution,
  savedSettings,
}: {
  investableNetWorth: number; // cents
  defaultAnnualExpenses: number; // cents
  defaultMonthlyContribution: number; // cents
  savedSettings: FireSettingsData | null;
}) {
  const router = useRouter();
  const [swr, setSwr] = useState(savedSettings ? parseFloat(savedSettings.swr) : 0.04);
  const [expectedReturn, setExpectedReturn] = useState(savedSettings ? parseFloat(savedSettings.expectedReturn) : 0.07);
  const [expensesInput, setExpensesInput] = useState(((savedSettings?.annualExpensesOverride ?? defaultAnnualExpenses) / 100).toFixed(0));
  const [contributionInput, setContributionInput] = useState(((savedSettings?.monthlyContributionOverride ?? defaultMonthlyContribution) / 100).toFixed(0));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const annualExpenses = Math.round((parseFloat(expensesInput) || 0) * 100);
  const monthlyContribution = Math.round((parseFloat(contributionInput) || 0) * 100);

  const { fireNumberValue, progress, yearsResult, chartPoints } = useMemo(() => {
    const fireNumberValue = fireNumber(annualExpenses, swr);
    const progress = fireProgressPct(investableNetWorth, fireNumberValue);
    const yearsResult = yearsToFire({ currentValue: investableNetWorth, monthlyContribution, annualReturnRate: expectedReturn, targetValue: fireNumberValue });
    const horizonYears = yearsResult.years != null ? Math.min(Math.max(Math.ceil(yearsResult.years) + 2, 5), 40) : 40;
    const chartPoints = projectionSeries({ currentValue: investableNetWorth, monthlyContribution, annualReturnRate: expectedReturn, horizonYears });
    return { fireNumberValue, progress, yearsResult, chartPoints };
  }, [annualExpenses, swr, investableNetWorth, monthlyContribution, expectedReturn]);

  const barPct = Math.min(1, Math.max(0, progress));

  async function save() {
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch("/api/fire", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          swr,
          expectedReturn,
          annualExpensesOverride: annualExpenses,
          monthlyContributionOverride: monthlyContribution,
        }),
      });
      if (!res.ok) throw new Error("Failed to save FIRE settings");
      setSaved(true);
      router.refresh();
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-6 p-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium uppercase tracking-wide text-text-3">Annual expenses</span>
          <div className="flex items-center gap-1.5">
            <span className="text-text-3 text-sm">$</span>
            <input
              type="number"
              step="1"
              min="0"
              value={expensesInput}
              onChange={(e) => setExpensesInput(e.target.value)}
              className="w-full h-9 rounded-control bg-surface-2 border border-border-strong px-2 text-sm text-text tabular"
            />
          </div>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium uppercase tracking-wide text-text-3">Monthly contribution</span>
          <div className="flex items-center gap-1.5">
            <span className="text-text-3 text-sm">$</span>
            <input
              type="number"
              step="1"
              min="0"
              value={contributionInput}
              onChange={(e) => setContributionInput(e.target.value)}
              className="w-full h-9 rounded-control bg-surface-2 border border-border-strong px-2 text-sm text-text tabular"
            />
          </div>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium uppercase tracking-wide text-text-3">Safe withdrawal rate — {formatPercent(swr)}</span>
          <input
            type="range"
            min={0.01}
            max={0.1}
            step={0.001}
            value={swr}
            onChange={(e) => setSwr(parseFloat(e.target.value))}
            className="w-full accent-[var(--brand)]"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium uppercase tracking-wide text-text-3">Expected annual return — {formatPercent(expectedReturn)}</span>
          <input
            type="range"
            min={-0.05}
            max={0.15}
            step={0.001}
            value={expectedReturn}
            onChange={(e) => setExpectedReturn(parseFloat(e.target.value))}
            className="w-full accent-[var(--brand)]"
          />
        </label>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between">
          <span className="text-xs font-medium uppercase tracking-wide text-text-3">FIRE number</span>
          <span className="font-display text-2xl text-text tabular">{formatCents(fireNumberValue)}</span>
        </div>
        <div className="h-2 rounded-full bg-sunken overflow-hidden">
          <div className="h-full rounded-full bg-brand transition-[width]" style={{ width: `${barPct * 100}%` }} />
        </div>
        <div className="flex items-center justify-between text-xs text-text-3">
          <span>{formatCents(investableNetWorth)} invested today</span>
          <span className="tabular">{formatPercent(progress)} of the way there</span>
        </div>
      </div>

      <div className={cn("rounded-control px-4 py-3", yearsResult.alreadyThere ? "bg-positive-subtle" : yearsResult.years == null ? "bg-warning-subtle" : "bg-brand-subtle")}>
        {yearsResult.alreadyThere ? (
          <span className="text-[15px] font-medium text-positive">You&apos;ve already hit your FIRE number.</span>
        ) : yearsResult.years == null ? (
          <span className="text-[15px] font-medium text-warning">Not reachable with these inputs — raise the contribution or expected return.</span>
        ) : (
          <span className="text-[15px] font-medium text-text">
            <span className="tabular">{yearsResult.years.toFixed(1)} years</span> to FIRE at this pace
          </span>
        )}
      </div>

      <FireProjectionChart points={chartPoints} fireNumberValue={fireNumberValue} />

      <div className="flex items-center gap-3">
        <Button onClick={save} disabled={saving} size="sm">
          {saving ? "Saving…" : "Save assumptions"}
        </Button>
        {saved && <span className="text-xs text-text-3">Saved</span>}
      </div>
    </div>
  );
}
