"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { formatCents, formatPercent } from "@tally/core/money";
import { fireNumber, fireProgressPct, yearsToFire, projectionSeries, ageAsOf, fireAgeAndYear } from "@tally/core/fireMath";
import { Button } from "@/components/ui/Button";
import { RangeSlider } from "@/components/ui/RangeSlider";
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
  birthDate,
  today,
}: {
  investableNetWorth: number; // cents
  defaultAnnualExpenses: number; // cents
  defaultMonthlyContribution: number; // cents
  savedSettings: FireSettingsData | null;
  birthDate: string | null;
  today: string; // server-computed "YYYY-MM-DD", so age math doesn't depend on the client's clock/hydration timing
}) {
  const router = useRouter();
  const [swr, setSwr] = useState(savedSettings ? parseFloat(savedSettings.swr) : 0.04);
  const [expectedReturn, setExpectedReturn] = useState(savedSettings ? parseFloat(savedSettings.expectedReturn) : 0.07);
  // A saved override wins; without one, the trailing-12-month default. save()
  // only stores an override when the value differs from that default, so an
  // untouched field keeps tracking real spending as it changes instead of
  // freezing at whatever it was the day "Save assumptions" was clicked.
  const [expensesInput, setExpensesInput] = useState(dollars(savedSettings?.annualExpensesOverride ?? defaultAnnualExpenses));
  const [contributionInput, setContributionInput] = useState(dollars(savedSettings?.monthlyContributionOverride ?? defaultMonthlyContribution));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const annualExpenses = Math.round((parseFloat(expensesInput) || 0) * 100);
  const monthlyContribution = Math.round((parseFloat(contributionInput) || 0) * 100);

  const { fireNumberValue, progress, yearsResult, chartPoints, ageResult } = useMemo(() => {
    const fireNumberValue = fireNumber(annualExpenses, swr);
    const progress = fireProgressPct(investableNetWorth, fireNumberValue);
    const yearsResult = yearsToFire({ currentValue: investableNetWorth, monthlyContribution, annualReturnRate: expectedReturn, targetValue: fireNumberValue });
    const horizonYears = yearsResult.years != null ? Math.min(Math.max(Math.ceil(yearsResult.years) + 2, 5), 40) : 40;
    const chartPoints = projectionSeries({ currentValue: investableNetWorth, monthlyContribution, annualReturnRate: expectedReturn, horizonYears });
    const ageResult = birthDate && yearsResult.years != null ? fireAgeAndYear(ageAsOf(birthDate, today), yearsResult.years, today) : null;
    return { fireNumberValue, progress, yearsResult, chartPoints, ageResult };
  }, [annualExpenses, swr, investableNetWorth, monthlyContribution, expectedReturn, birthDate, today]);

  const barPct = Math.min(1, Math.max(0, progress));

  // Inputs are whole dollars, so compare at that precision.
  const expensesIsDefault = annualExpenses === Math.round(defaultAnnualExpenses / 100) * 100;
  const contributionIsDefault = monthlyContribution === Math.round(defaultMonthlyContribution / 100) * 100;

  async function save() {
    setSaving(true);
    setSaved(false);
    setSaveError(null);
    try {
      const res = await fetch("/api/fire", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          swr,
          expectedReturn,
          annualExpensesOverride: expensesIsDefault ? null : annualExpenses,
          monthlyContributionOverride: contributionIsDefault ? null : monthlyContribution,
        }),
      });
      if (!res.ok) throw new Error("Failed to save FIRE settings");
      setSaved(true);
      router.refresh();
    } catch (err) {
      console.error(err);
      setSaveError("Couldn't save. Try again.");
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
          <DefaultHint isDefault={expensesIsDefault} defaultCents={defaultAnnualExpenses} onReset={() => setExpensesInput(dollars(defaultAnnualExpenses))} />
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
          <DefaultHint isDefault={contributionIsDefault} defaultCents={defaultMonthlyContribution} onReset={() => setContributionInput(dollars(defaultMonthlyContribution))} />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium uppercase tracking-wide text-text-3">Safe withdrawal rate: {formatPercent(swr)}</span>
          <RangeSlider min={0.01} max={0.1} step={0.001} value={swr} onChange={setSwr} />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium uppercase tracking-wide text-text-3">Expected annual return: {formatPercent(expectedReturn)}</span>
          <RangeSlider min={-0.05} max={0.15} step={0.001} value={expectedReturn} onChange={setExpectedReturn} />
        </label>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between">
          <span className="text-xs font-medium uppercase tracking-wide text-text-3">FIRE number</span>
          <span className="text-right font-display text-2xl text-text tabular">{formatCents(fireNumberValue)}</span>
        </div>
        <div className="h-2 rounded-full bg-sunken overflow-hidden">
          <div className="h-full rounded-full bg-brand transition-[width]" style={{ width: `${barPct * 100}%` }} />
        </div>
        <div className="flex items-center justify-between text-xs text-text-3">
          <span className="tabular money">{formatCents(investableNetWorth)} invested today</span>
          <span className="tabular">{formatPercent(progress)} of the way there</span>
        </div>
      </div>

      <div className={cn("rounded-control px-4 py-3", yearsResult.alreadyThere ? "bg-positive-subtle" : yearsResult.years == null ? "bg-warning-subtle" : "bg-brand-subtle")}>
        {yearsResult.alreadyThere ? (
          <span className="text-[15px] font-medium text-positive">You&apos;ve already hit your FIRE number.</span>
        ) : yearsResult.years == null ? (
          <span className="text-[15px] font-medium text-warning">Not reachable with these inputs. Raise the contribution or expected return.</span>
        ) : (
          <div className="flex flex-col gap-1">
            <span className="text-[15px] font-medium text-text">
              <span className="tabular">{yearsResult.years.toFixed(1)} years</span> to FIRE at this pace
            </span>
            {ageResult ? (
              <span className="text-[13px] text-text-2">
                You&apos;ll be <span className="tabular">{Math.round(ageResult.age)}</span> in <span className="tabular">{ageResult.year}</span>
              </span>
            ) : (
              <span className="text-[13px] text-text-3">
                <Link href="/settings" className="text-brand hover:underline">
                  Add your birthdate
                </Link>{" "}
                to see the age you&apos;ll hit this at, not just years away.
              </span>
            )}
          </div>
        )}
      </div>

      <FireProjectionChart points={chartPoints} fireNumberValue={fireNumberValue} />

      <div className="flex items-center gap-3">
        <Button onClick={save} disabled={saving} size="sm">
          {saving ? "Saving…" : "Save assumptions"}
        </Button>
        {saved && <span className="text-xs text-text-3">Saved</span>}
        {saveError && <span className="text-xs text-negative">{saveError}</span>}
      </div>
    </div>
  );
}

function dollars(cents: number): string {
  return (cents / 100).toFixed(0);
}

/** Under an expenses/contribution input: where the number comes from, and a way back to the actual figure. */
function DefaultHint({ isDefault, defaultCents, onReset }: { isDefault: boolean; defaultCents: number; onReset: () => void }) {
  if (isDefault) return <span className="text-xs text-text-3">From your last 12 months</span>;
  return (
    <span className="text-xs text-text-3">
      Your own amount ·{" "}
      <button type="button" onClick={onReset} className="text-brand hover:underline">
        Use actual ({formatCents(defaultCents)})
      </button>
    </span>
  );
}
