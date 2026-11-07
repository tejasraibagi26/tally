"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatCents } from "@tally/core/money";
import { monthSummary, type MonthContext } from "@tally/core/budgetView";
import { budgetRunway, type RunwayContext, type RunwayState } from "@tally/core/budgetRunway";
import { goalCost, goalCostTotal, type GoalCost } from "@tally/core/goalCost";
import { computeBurnRateProjection } from "@tally/core/budgetMath";
import { Card } from "@/components/ui/Card";
import { BudgetPanel } from "@/components/budgets/BudgetPanel";
import { cn } from "@/lib/cn";
import { showToast } from "@/lib/toast";
import type { BudgetLine, UnbudgetedSpend } from "@/lib/budgets";

function fmt(c: number) {
  return formatCents(c).replace(/\.00$/, "");
}

/** The runway fill: brand carries, marigold lands short, red is gone. */
const FILL: Record<RunwayState, string> = {
  carries: "var(--brand)",
  untouched: "var(--brand)",
  lands_short: "var(--marigold)",
  runs_dry: "var(--negative)",
  over: "var(--negative)",
  fixed: "var(--border-strong)",
  not_current: "var(--border-strong)",
};

/** "NOV 1", "NOV 30": the two ends of the runway's calendar. */
function monthEdge(month: string, day: number): string {
  return new Date(`${month.slice(0, 8)}${String(day).padStart(2, "0")}T00:00:00Z`)
    .toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })
    .toUpperCase();
}

function daysLabel(days: number): string {
  const n = days === Math.round(days) ? String(days) : days.toFixed(1);
  return `${n} ${days === 1 ? "day" : "days"}`;
}

/**
 * What a budget is for, from what Tally actually knows: its parent category,
 * whether the amount is fixed, and any rollover. Budgets carry no description
 * of their own, so this stands in rather than inventing one.
 */
function whatFor(line: BudgetLine): string | null {
  const parts: string[] = [];
  if (line.parentName && line.parentName !== line.categoryName) parts.push(line.parentName);
  if (line.isFixedAmount) parts.push("fixed amount");
  if (line.rolloverFromPrior > 0) parts.push(`+${fmt(line.rolloverFromPrior)} rolled over`);
  return parts.length > 0 ? parts.join(" · ") : null;
}

function GoalCostCell({ cost }: { cost: GoalCost }) {
  if (cost.kind === "none") {
    return <span className="text-[12.5px] text-text-3">{cost.days == null ? "no goal set" : "nothing"}</span>;
  }
  return (
    <span className="flex flex-col gap-0.5 lg:items-end">
      {cost.label && <span className="text-[14px] font-semibold text-negative tabular">{cost.label}</span>}
      {cost.note && <span className="text-[12.5px] text-text-3">{cost.note}</span>}
    </span>
  );
}

/**
 * The Budgets body on the goal view: a totals strip, then one row per budget
 * as four columns, being what it is for, what is left, how far that carries
 * you through the month, and what it costs the goal.
 *
 * Flat rather than grouped by parent category, which the classic view keeps:
 * the runway column only reads as a comparison when every row shares one
 * calendar, and section headers break it into unrelated stretches.
 */
export function BudgetsGoalView({
  month,
  ctx,
  runwayCtx,
  budgets,
  unbudgeted,
  note,
}: {
  month: string;
  ctx: MonthContext;
  runwayCtx: RunwayContext & { neededPerMonth: number | null };
  budgets: BudgetLine[];
  unbudgeted: UnbudgetedSpend[];
  /** The goal-cost sentence, rendered inside the totals card. */
  note?: React.ReactNode;
}) {
  const router = useRouter();
  const [openId, setOpenId] = useState<string | null>(null);
  const open = budgets.find((b) => b.categoryId === openId) ?? null;

  const summary = monthSummary(budgets, ctx);
  const unbudgetedTotal = unbudgeted.reduce((s, u) => s + u.spend, 0);
  const { neededPerMonth, ...runway } = runwayCtx;
  const current = runway.daysElapsed != null;

  const rows = budgets.map((line) => {
    const available = line.amount + line.rolloverFromPrior;
    const projectedSpend =
      !line.isFixedAmount && runway.daysElapsed != null
        ? computeBurnRateProjection(line.spend, runway.daysElapsed, runway.daysInMonth)
        : null;
    return {
      line,
      available,
      r: budgetRunway({ available, spend: line.spend, isFixedAmount: line.isFixedAmount }, runway, fmt),
      cost: goalCost({
        over: Math.max(0, line.spend - available),
        projectedOver: projectedSpend != null ? Math.max(0, projectedSpend - available) : null,
        neededPerMonth,
        daysInMonth: runway.daysInMonth,
      }),
    };
  });

  const costingDays = goalCostTotal(
    budgets.map((b) => b.spend - (b.amount + b.rolloverFromPrior)),
    neededPerMonth,
    runway.daysInMonth,
  );

  // One column template, shared by the headings and every row, so they stay
  // aligned. Below lg the cells stack and label themselves.
  const cols = "lg:grid-cols-[minmax(0,230px)_112px_minmax(0,1fr)_136px]";

  return (
    <>
      {/* Totals, with what the month is costing the goal beside the money, so
          the page opens on the same trade-off every row below repeats. */}
      <Card className="flex flex-wrap items-end gap-x-9 gap-y-5 p-5">
        <div className="flex flex-col gap-0.5">
          <span className="text-xs font-medium uppercase tracking-[0.07em] text-text-3">
            {summary.left < 0 ? "Over budget" : ctx.phase === "past" ? "Left unspent" : "Left to spend"}
          </span>
          <span className={cn("font-display text-[30px] leading-tight tabular money", summary.left < 0 ? "text-negative" : "text-text")}>
            {fmt(Math.abs(summary.left))}
          </span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-xs font-medium uppercase tracking-[0.07em] text-text-3">Spent</span>
          <span className="font-display text-[30px] leading-tight tabular money text-text">{fmt(summary.spent)}</span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-xs font-medium uppercase tracking-[0.07em] text-text-3">Budgeted</span>
          <span className="font-display text-[30px] leading-tight tabular money text-text-3">{fmt(summary.budgeted)}</span>
        </div>
        {costingDays != null && (
          <div className="flex flex-col gap-0.5">
            <span className="text-xs font-medium uppercase tracking-[0.07em] text-text-3">Costing the goal</span>
            <span className={cn("font-display text-[30px] leading-tight tabular", costingDays > 0 ? "text-negative" : "text-text")}>
              {costingDays > 0 ? daysLabel(costingDays) : "Nothing"}
            </span>
          </div>
        )}
        {note && <div className="ml-auto max-w-[44ch] text-[13px] text-text-2">{note}</div>}
      </Card>

      <Card className="overflow-hidden">
        <div className="flex items-baseline justify-between gap-4 border-b border-border px-5 py-[14px]">
          <h2 className="ui-card-title m-0 text-xl font-semibold text-text">
            {budgets.length} {budgets.length === 1 ? "budget" : "budgets"}
          </h2>
          <span className="text-[13px] text-text-3">Pick a row to edit it</span>
        </div>

        {/* Column headings, desktop only: below lg the cells stack, where a
            header row would sit above the wrong thing. */}
        <div className={cn("hidden gap-5 px-5 pb-2.5 pt-3 text-xs font-medium uppercase tracking-[0.07em] text-text-3 lg:grid", cols)}>
          <span>Budget · what it&apos;s for</span>
          <span className="text-right">Left</span>
          <span>{current ? `How far that carries you · ${monthEdge(month, 1)} to ${monthEdge(month, runway.daysInMonth)}` : "The month"}</span>
          <span className="text-right">Costs the goal</span>
        </div>

        {rows.map(({ line, available, r, cost }) => (
          <button
            key={line.categoryId}
            type="button"
            onClick={() => setOpenId(line.categoryId)}
            className={cn(
              "grid w-full gap-x-5 gap-y-3 border-t border-border px-5 py-4 text-left hover:bg-surface-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-info",
              cols,
            )}
          >
            <span className="flex min-w-0 flex-col gap-0.5">
              <span className="flex items-center gap-2">
                <span className="h-2 w-2 flex-none rounded-full" style={{ background: `var(--series-${line.colorSlot})` }} aria-hidden="true" />
                <span className="truncate text-[15px] font-medium text-text">{line.categoryName}</span>
              </span>
              {whatFor(line) && <span className="pl-4 text-[12.5px] text-text-3">{whatFor(line)}</span>}
            </span>

            <span className="flex flex-col lg:items-end">
              <span className={cn("font-display text-[23px] leading-tight tabular money", r.left < 0 ? "text-negative" : "text-text")}>
                {r.left < 0 ? `−${fmt(-r.left)}` : fmt(r.left)}
              </span>
              <span className={cn("font-mono text-[11px] leading-snug tabular money", r.left < 0 ? "text-negative" : "text-text-3")}>
                {r.left < 0 ? `${formatCents(line.spend)} of ${formatCents(available)}` : `of ${formatCents(available)}`}
              </span>
            </span>

            <span className="flex flex-col gap-1.5">
              <span className="relative flex h-2 overflow-hidden rounded-full bg-sunken" aria-hidden="true">
                <span className="absolute inset-y-0 left-0 bg-border" style={{ width: `${r.todayPct * 100}%` }} />
                <span className="absolute inset-y-0" style={{ left: `${r.todayPct * 100}%`, width: `${r.carryPct * 100}%`, background: FILL[r.state] }} />
                {r.todayPct > 0 && <span className="absolute inset-y-0 w-px bg-text" style={{ left: `${r.todayPct * 100}%` }} />}
              </span>
              {current && (
                <span className="flex justify-between font-mono text-[10.5px] tracking-[0.03em] text-text-3">
                  <span>{monthEdge(month, 1)}</span>
                  <span>TODAY</span>
                  <span>{monthEdge(month, runway.daysInMonth)}</span>
                </span>
              )}
              <span className="text-[13px] text-text-2 tabular">{r.sentence}</span>
            </span>

            <GoalCostCell cost={cost} />
          </button>
        ))}

        {unbudgeted.length > 0 && (
          <div className="flex items-center justify-between gap-4 border-t border-border bg-sunken px-5 py-3.5">
            <span className="flex min-w-0 flex-col gap-0.5">
              <span className="text-[13.5px] text-text-2">
                Not budgeted · {unbudgeted.length} {unbudgeted.length === 1 ? "category" : "categories"}
              </span>
              <span className="truncate text-xs text-text-3">
                {unbudgeted.slice(0, 4).map((u) => `${u.categoryName} ${fmt(u.spend)}`).join(" · ")}
              </span>
            </span>
            <span className="tabular money text-[13.5px] text-text">{fmt(unbudgetedTotal)}</span>
          </div>
        )}
      </Card>

      <BudgetPanel
        month={month}
        line={open}
        onClose={() => setOpenId(null)}
        onRemoved={(undo) => {
          setOpenId(null);
          // The app-wide toast, with Undo (lib/toast.ts), same as the classic view.
          showToast(`${open?.categoryName ?? "Budget"} removed`, "positive", {
            label: "Undo",
            onPress: () => void undo().then(() => router.refresh()),
          });
        }}
      />
    </>
  );
}
