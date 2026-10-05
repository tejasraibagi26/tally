"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ComposedChart, Area, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, ReferenceDot, CartesianGrid } from "recharts";
import { formatCents, formatPercent } from "@tally/core/money";
import {
  ageAsOf,
  fireMilestones,
  fireNumber,
  fireProgressPct,
  fireWhatIfs,
  projectionSeries,
  realReturn,
  requiredMonthlySaving,
  yearsToFire,
} from "@tally/core/fireMath";
import { cn } from "@/lib/cn";
import { Card } from "@/components/ui/Card";
import { RangeSlider } from "@/components/ui/RangeSlider";
import type { FireAccount, FireSettingsView } from "@/lib/fire";

const DEFAULTS = { swr: 0.04, expectedReturn: 0.07, inflation: 0.02 };
/** Retirement age the not-reachable state solves for when no better target exists. */
const TARGET_AGE = 55;
const SAVE_DEBOUNCE_MS = 800;

function money(c: number): string {
  return formatCents(c).replace(/\.00$/, "");
}

function compact(c: number): string {
  const d = c / 100;
  if (Math.abs(d) >= 1_000_000) return `$${(d / 1_000_000).toFixed(d >= 10_000_000 ? 1 : 2).replace(/\.?0+$/, "")}M`;
  if (Math.abs(d) >= 1000) return `$${Math.round(d / 1000)}K`;
  return `$${Math.round(d)}`;
}

function pct1(x: number): string {
  return `${(x * 100).toFixed(1)}%`;
}

/**
 * The FIRE planner: the answer first (age and year), a projection chart with
 * the target and a ±1% band, what-ifs in years, milestones, and the levers --
 * which save themselves. Math in @tally/core/fireMath; the projection runs on
 * the return after inflation, matching spending in today's dollars.
 */
export function FirePlanner({
  investedTodayAll,
  accounts,
  defaultAnnualExpenses,
  defaultMonthlyContribution,
  coveredMonths,
  saved,
  birthDate,
  today,
}: {
  investedTodayAll: number;
  accounts: FireAccount[];
  defaultAnnualExpenses: number;
  defaultMonthlyContribution: number;
  coveredMonths: number;
  saved: FireSettingsView | null;
  birthDate: string | null;
  today: string;
}) {
  const [swr, setSwr] = useState(saved?.swr ?? DEFAULTS.swr);
  const [marketReturn, setMarketReturn] = useState(saved?.expectedReturn ?? DEFAULTS.expectedReturn);
  const [inflation, setInflation] = useState(saved?.inflation ?? DEFAULTS.inflation);
  const [expenses, setExpenses] = useState(saved?.annualExpensesOverride ?? defaultAnnualExpenses);
  const [saving, setSaving] = useState(saved?.monthlyContributionOverride ?? defaultMonthlyContribution);
  const [excluded, setExcluded] = useState<ReadonlySet<string>>(new Set(saved?.excludedAccountIds ?? []));
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [accountsOpen, setAccountsOpen] = useState(false);
  const firstRender = useRef(true);

  const invested = accounts.length ? accounts.filter((a) => !excluded.has(a.id)).reduce((s, a) => s + a.value, 0) : investedTodayAll;
  const r = realReturn(marketReturn, inflation);
  const age = birthDate ? ageAsOf(birthDate, today) : null;
  const plan = { currentValue: invested, monthlyContribution: saving, annualReturnRate: r, annualExpenses: expenses, swr };

  const view = useMemo(() => {
    const target = fireNumber(expenses, swr);
    const result = yearsToFire({ currentValue: invested, monthlyContribution: saving, annualReturnRate: r, targetValue: target });
    const years = result.alreadyThere ? 0 : result.years;
    const horizon = Math.min(45, Math.max(10, Math.ceil((years ?? 30) + 3)));
    const mid = projectionSeries({ currentValue: invested, monthlyContribution: saving, annualReturnRate: r, horizonYears: horizon });
    const lo = projectionSeries({ currentValue: invested, monthlyContribution: saving, annualReturnRate: r - 0.01, horizonYears: horizon });
    const hi = projectionSeries({ currentValue: invested, monthlyContribution: saving, annualReturnRate: r + 0.01, horizonYears: horizon });
    const points = mid.map((p, i) => ({ t: p.year, mid: p.projectedValue, band: [lo[i]!.projectedValue, hi[i]!.projectedValue] as [number, number] }));
    return { target, result, years, points, progress: fireProgressPct(invested, target) };
  }, [expenses, swr, invested, saving, r]);

  const milestones = useMemo(() => fireMilestones(plan, age), [plan.currentValue, plan.monthlyContribution, plan.annualReturnRate, plan.annualExpenses, plan.swr, age]); // eslint-disable-line react-hooks/exhaustive-deps
  const whatIfs = useMemo(() => fireWhatIfs(plan), [plan.currentValue, plan.monthlyContribution, plan.annualReturnRate, plan.annualExpenses, plan.swr]); // eslint-disable-line react-hooks/exhaustive-deps

  // Autosave, debounced. Overrides are stored only when they differ from the data-driven default.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    setSaveState("saving");
    const t = setTimeout(async () => {
      try {
        const res = await fetch("/api/fire", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            swr,
            expectedReturn: marketReturn,
            inflation,
            annualExpensesOverride: expenses === defaultAnnualExpenses ? null : expenses,
            monthlyContributionOverride: saving === defaultMonthlyContribution ? null : saving,
            excludedAccountIds: [...excluded],
          }),
        });
        setSaveState(res.ok ? "saved" : "error");
      } catch {
        setSaveState("error");
      }
    }, SAVE_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [swr, marketReturn, inflation, expenses, saving, excluded, defaultAnnualExpenses, defaultMonthlyContribution]);

  function resetAll() {
    setSwr(DEFAULTS.swr);
    setMarketReturn(DEFAULTS.expectedReturn);
    setInflation(DEFAULTS.inflation);
    setExpenses(defaultAnnualExpenses);
    setSaving(defaultMonthlyContribution);
    setExcluded(new Set());
  }

  const { target, result, years, points, progress } = view;
  const year = years != null ? new Date(`${today}T00:00:00`).getFullYear() + Math.round(years) : null;
  const retireAge = age != null && years != null ? Math.floor(age + years) : null;
  const yearsToTarget = age != null ? Math.max(1, TARGET_AGE - age) : 20;
  const needed = result.years == null && !result.alreadyThere ? requiredMonthlySaving(invested, target, r, yearsToTarget) : null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
      <div className="lg:col-span-2 flex flex-col gap-4">
        <Card className="p-5 lg:p-6 flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div className="flex flex-col gap-2">
              {result.alreadyThere ? (
                <>
                  <span className="text-xs font-medium uppercase tracking-wide text-text-3">{"You've reached your number"}</span>
                  <span className="font-display text-[44px] leading-none text-positive tabular money">{compact(invested)}</span>
                  <span className="text-[13.5px] text-text-2">
                    {formatPercent(progress)} of {compact(target)}. At {pct1(swr)} it supports {money(invested * swr)} a year.
                  </span>
                </>
              ) : years == null ? (
                <>
                  <span className="text-xs font-medium uppercase tracking-wide text-text-3">At this pace</span>
                  <span className="font-display text-[40px] leading-none text-text">Not reachable</span>
                  <span className="text-[13.5px] text-text-2">
                    With {money(saving)} a month and {pct1(r)} after inflation, {compact(invested)} never grows to {compact(target)}.
                  </span>
                </>
              ) : (
                <>
                  <span className="text-xs font-medium uppercase tracking-wide text-text-3">{retireAge != null ? "You could retire at" : "You could retire in"}</span>
                  <span className="font-display text-[48px] leading-none text-text tabular">
                    {retireAge != null ? (
                      <>
                        {retireAge} <span className="text-[24px] text-text-2">in {year}</span>
                      </>
                    ) : (
                      year
                    )}
                  </span>
                  <span className="text-[13.5px] text-text-2">
                    {years.toFixed(1)} years away · <span className="money tabular">{money(invested)}</span> of <span className="tabular">{money(target)}</span> ({formatPercent(progress)})
                    {retireAge == null && (
                      <>
                        {" · "}
                        <Link href="/settings" className="text-brand hover:underline">
                          Add your birth date
                        </Link>{" "}
                        to see your age then
                      </>
                    )}
                  </span>
                </>
              )}
            </div>
            <div className="flex flex-col gap-1 text-xs text-text-3 sm:items-end">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-3.5 h-0.5 bg-brand" /> Projected at {pct1(r)} after inflation
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-3.5 h-2 rounded-sm bg-brand opacity-25" /> If returns are 1% lower or higher
              </span>
            </div>
          </div>

          <ResponsiveContainer width="100%" height={250}>
            <ComposedChart data={points} margin={{ top: 18, right: 12, left: 4, bottom: 0 }}>
              <CartesianGrid stroke="var(--border)" vertical={false} />
              <XAxis
                dataKey="t"
                type="number"
                domain={[0, "dataMax"]}
                tickFormatter={(t: number) => (age != null ? (t === 0 ? `${age} · now` : String(age + t)) : t === 0 ? "Now" : `+${t}y`)}
                tick={{ fill: "var(--text-3)", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                minTickGap={36}
              />
              <YAxis tickFormatter={compact} tick={{ fill: "var(--text-3)", fontSize: 11 }} axisLine={false} tickLine={false} width={52} domain={[0, (max: number) => Math.max(max, target * 1.15)]} />
              <Tooltip
                content={({ active, payload }) => {
                  const p = active ? (payload?.[0]?.payload as (typeof points)[number] | undefined) : undefined;
                  if (!p) return null;
                  return (
                    <div className="rounded-control border border-border bg-raised shadow-overlay px-3 py-2 text-xs flex flex-col gap-0.5">
                      <span className="text-text-3">{age != null ? `Age ${age + p.t}` : `In ${p.t} years`} · {new Date(`${today}T00:00:00`).getFullYear() + p.t}</span>
                      <span className="tabular text-text">{money(p.mid)}</span>
                    </div>
                  );
                }}
              />
              <Area dataKey="band" stroke="none" fill="var(--brand)" fillOpacity={0.12} isAnimationActive={false} />
              <ReferenceLine y={target} stroke="var(--positive)" strokeWidth={1.5} label={{ value: `Target ${compact(target)}`, position: "insideTopLeft", fill: "var(--positive)", fontSize: 11, fontWeight: 600 }} />
              <Line dataKey="mid" stroke="var(--brand)" strokeWidth={2.5} dot={false} isAnimationActive={false} />
              {years != null && years > 0 && (
                <ReferenceDot
                  x={years}
                  y={target}
                  r={5}
                  fill="var(--positive)"
                  stroke="var(--surface)"
                  strokeWidth={2}
                  label={{ value: retireAge != null ? `Retire at ${retireAge} · ${year}` : `Retire in ${year}`, position: "bottom", fill: "var(--text)", fontSize: 12, fontWeight: 600, offset: 12 }}
                />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        </Card>

        {needed != null && (
          <div className="flex items-center gap-3 rounded-card border border-border bg-info-subtle px-4 py-3">
            <div className="flex-1 flex flex-col gap-0.5">
              <span className="text-[14px] font-semibold text-info">To retire {age != null ? `at ${TARGET_AGE}` : `in ${yearsToTarget} years`}</span>
              <span className="text-[13px] text-text-2">Save {money(Math.ceil(needed / 100) * 100)} a month at these returns.</span>
            </div>
            <button type="button" onClick={() => setSaving(Math.ceil(needed / 100) * 100)} className="h-8 px-3.5 rounded-full bg-brand-subtle text-brand text-[13px] font-semibold">
              Use {money(Math.ceil(needed / 100) * 100)}
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="p-5 flex flex-col gap-1">
            <h2 className="m-0 mb-1 text-[15px] font-semibold text-text">What if</h2>
            {whatIfs.map((w, i) => (
              <div key={w.label} className={cn("flex items-center justify-between gap-3 py-2 text-[13.5px]", i > 0 && "border-t border-border")}>
                <span className="text-text-2">{w.label}</span>
                <span className={cn("tabular font-medium", w.yearsSooner == null ? "text-text-3" : w.yearsSooner >= 0 ? "text-positive" : "text-negative")}>
                  {w.yearsSooner == null ? "—" : `${Math.abs(w.yearsSooner).toFixed(1)} yr${Math.abs(w.yearsSooner) >= 1.05 ? "s" : ""} ${w.yearsSooner >= 0 ? "sooner" : "later"}`}
                </span>
              </div>
            ))}
          </Card>
          <Card className="p-5 flex flex-col gap-1">
            <h2 className="m-0 mb-1 text-[15px] font-semibold text-text">Milestones</h2>
            {milestones.map((m, i) => (
              <div key={m.key} className={cn("flex items-center gap-3 py-2 text-[13.5px]", i > 0 && "border-t border-border")}>
                <span className={cn("w-2.5 h-2.5 rounded-full border-2 flex-none", m.reached ? "bg-positive border-positive" : "border-text-3")} />
                <span className="flex-1 flex flex-col">
                  <span className="text-text">
                    {m.label} <span className="text-text-3">· {compact(m.value)}</span>
                  </span>
                  {m.detail && <span className="text-xs text-text-3">{m.detail}</span>}
                </span>
                <span className="tabular text-text-3">
                  {m.reached ? "Reached" : m.years == null ? "—" : new Date(`${today}T00:00:00`).getFullYear() + Math.round(m.years)}
                </span>
              </div>
            ))}
          </Card>
        </div>
      </div>

      <Card className="p-5 flex flex-col gap-5 lg:sticky lg:top-4">
        <div className="flex items-center justify-between">
          <h2 className="m-0 text-[15px] font-semibold text-text">Your levers</h2>
          <span className="flex items-center gap-3 text-xs">
            <span className={cn(saveState === "error" ? "text-negative" : "text-text-3")}>
              {saveState === "saving" ? "Saving…" : saveState === "saved" ? "Saved" : saveState === "error" ? "Couldn't save" : ""}
            </span>
            <button type="button" onClick={resetAll} className="text-brand hover:underline">
              Reset all
            </button>
          </span>
        </div>

        {coveredMonths > 0 && coveredMonths < 12 && (
          <p className="m-0 rounded-control bg-info-subtle px-3 py-2 text-xs text-text-2">
            Spending is an estimate: only {coveredMonths} month{coveredMonths === 1 ? "" : "s"} of history so far, scaled up to a year.
          </p>
        )}

        <Lever
          label="Monthly saving"
          value={saving}
          display={money(saving)}
          min={0}
          max={Math.max(1_000_000, defaultMonthlyContribution * 3, saving)}
          step={5000}
          onChange={setSaving}
          money
          hint={saving === defaultMonthlyContribution ? "Last 12 months: income minus spending" : undefined}
          reset={saving !== defaultMonthlyContribution ? { label: `Use actual (${money(defaultMonthlyContribution)})`, run: () => setSaving(defaultMonthlyContribution) } : undefined}
        />
        <Lever
          label="Yearly spending"
          value={expenses}
          display={money(expenses)}
          min={0}
          max={Math.max(20_000_000, defaultAnnualExpenses * 3, expenses)}
          step={50000}
          onChange={setExpenses}
          money
          hint={expenses === defaultAnnualExpenses ? "Your last 12 months, in today's dollars" : undefined}
          reset={expenses !== defaultAnnualExpenses ? { label: `Use actual (${money(defaultAnnualExpenses)})`, run: () => setExpenses(defaultAnnualExpenses) } : undefined}
        />
        <Lever label="Market return" value={marketReturn} display={pct1(marketReturn)} min={-0.02} max={0.12} step={0.0025} onChange={setMarketReturn} />
        <Lever label="Inflation" value={inflation} display={pct1(inflation)} min={0} max={0.06} step={0.0025} onChange={setInflation} hint={`Return after inflation: ${pct1(r)}`} />
        <Lever label="Withdrawal rate" value={swr} display={pct1(swr)} min={0.025} max={0.06} step={0.0025} onChange={setSwr} hint={`Target = spending ÷ ${pct1(swr)} = ${compact(target)}`} />

        <div className="border-t border-border pt-3 flex flex-col gap-2 text-xs text-text-3">
          <span>
            Invested today: <span className="money tabular text-text">{money(invested)}</span> from {accounts.filter((a) => !excluded.has(a.id)).length} of {accounts.length} investment account
            {accounts.length === 1 ? "" : "s"}, in CAD.{" "}
            {accounts.length > 0 && (
              <button type="button" onClick={() => setAccountsOpen((v) => !v)} className="text-brand hover:underline">
                {accountsOpen ? "Done" : "Choose accounts"}
              </button>
            )}
          </span>
          {accountsOpen && (
            <ul className="m-0 p-0 list-none flex flex-col">
              {accounts.map((a) => (
                <li key={a.id}>
                  <label className="flex items-center gap-2 py-1.5 text-[13px] text-text cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!excluded.has(a.id)}
                      onChange={(e) =>
                        setExcluded((prev) => {
                          const next = new Set(prev);
                          if (e.target.checked) next.delete(a.id);
                          else next.add(a.id);
                          return next;
                        })
                      }
                      className="accent-[var(--brand)]"
                    />
                    <span className="flex-1 truncate">{a.name}</span>
                    <span className="money tabular text-text-3">{money(a.value)}</span>
                  </label>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Card>
    </div>
  );
}

function Lever({
  label,
  value,
  display,
  min,
  max,
  step,
  onChange,
  money: isMoney,
  hint,
  reset,
}: {
  label: string;
  value: number;
  display: string;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  money?: boolean;
  hint?: string;
  reset?: { label: string; run: () => void };
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  function commit() {
    const n = parseFloat(draft.replace(/[$,%\s]/g, ""));
    if (Number.isFinite(n)) onChange(isMoney ? Math.round(n * 100) : n / 100);
    setEditing(false);
  }
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between text-[13px]">
        <span className="text-text-2">{label}</span>
        {editing ? (
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "Enter") commit();
              if (e.key === "Escape") setEditing(false);
            }}
            aria-label={label}
            className="w-28 h-7 rounded-[6px] bg-surface-2 border border-border-strong px-2 text-right text-[13px] text-text tabular"
          />
        ) : (
          <button
            type="button"
            onClick={() => {
              setDraft(isMoney ? String(Math.round(value / 100)) : (value * 100).toFixed(2).replace(/\.?0+$/, ""));
              setEditing(true);
            }}
            title="Type a value"
            className="tabular font-semibold text-text hover:underline decoration-dotted"
          >
            {display}
          </button>
        )}
      </div>
      <RangeSlider min={min} max={max} step={step} value={Math.min(max, Math.max(min, value))} onChange={onChange} />
      {(hint || reset) && (
        <span className="text-xs text-text-3">
          {reset ? (
            <>
              Your own amount ·{" "}
              <button type="button" onClick={reset.run} className="text-brand hover:underline">
                {reset.label}
              </button>
            </>
          ) : (
            hint
          )}
        </span>
      )}
    </div>
  );
}
