"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatCents } from "@tally/core/money";
import { monthSummary, type MonthContext } from "@tally/core/budgetView";
import { budgetRunway, type RunwayContext } from "@tally/core/budgetRunway";
import { budgetStatus, type BudgetTone } from "@tally/core/budgetStatus";
import { goalCost, goalCostTotal } from "@tally/core/goalCost";
import { computeBurnRateProjection } from "@tally/core/budgetMath";
import { Card } from "@/components/ui/Card";
import { BudgetPanel } from "@/components/budgets/BudgetPanel";
import { cn } from "@/lib/cn";
import { showToast } from "@/lib/toast";
import type { BudgetLine, UnbudgetedSpend } from "@/lib/budgets";

function fmt(c: number) {
  return formatCents(c).replace(/\.00$/, "");
}

/**
 * One meaning per colour, bar and text alike. A settled bar (paid, or not
 * this month) has no verdict, so it wears the category's own colour.
 */
function toneFill(tone: BudgetTone, colorSlot: number): string {
  if (tone === "settled") return `var(--series-${colorSlot})`;
  return tone === "ahead" ? "var(--marigold)" : tone === "over" ? "var(--negative)" : "var(--brand)";
}
const TONE_TEXT: Record<BudgetTone, string> = {
  ok: "text-text-2",
  ahead: "text-warning",
  over: "text-negative",
  settled: "text-text-2",
};

function daysLabel(days: number): string {
  const n = days === Math.round(days) ? String(days) : days.toFixed(1);
  return `${n} ${days === 1 ? "day" : "days"}`;
}

/**
 * What a budget is for: the user's own line when they've written one (set in
 * the budget panel, stored on the category so it holds across months), and
 * otherwise what Tally can tell on its own, being the parent category,
 * whether the amount is fixed, and any rollover.
 */
function whatFor(line: BudgetLine): string | null {
  if (line.description) return line.description;
  const parts: string[] = [];
  if (line.parentName && line.parentName !== line.categoryName) parts.push(line.parentName);
  if (line.isFixedAmount) parts.push("fixed amount");
  if (line.rolloverFromPrior > 0) parts.push(`+${fmt(line.rolloverFromPrior)} rolled over`);
  return parts.length > 0 ? parts.join(" · ") : null;
}

/**
 * The Budgets body on the goal view: a totals strip, then one row per budget
 * as three columns: what it is for, a bar of what's spent with a mark for
 * today and one status line under it, and what is left. The goal cost rides
 * on the status line only for the rows that have one (@tally/core/budgetStatus),
 * and the month's total sits in the totals strip.
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
    const r = budgetRunway({ available, spend: line.spend, isFixedAmount: line.isFixedAmount }, runway, fmt);
    const cost = goalCost({
      over: Math.max(0, line.spend - available),
      projectedOver: projectedSpend != null ? Math.max(0, projectedSpend - available) : null,
      neededPerMonth,
      daysInMonth: runway.daysInMonth,
    });
    return { line, available, r, status: budgetStatus({ available, spend: line.spend, month }, r, cost, fmt) };
  });

  const costingDays = goalCostTotal(
    budgets.map((b) => b.spend - (b.amount + b.rolloverFromPrior)),
    neededPerMonth,
    runway.daysInMonth,
  );

  // One column template for every row. Below lg the cells stack.
  const cols = "lg:grid-cols-[minmax(0,240px)_minmax(0,1fr)_120px] lg:items-center";

  return (
    <>
      {/* Totals, with what the month is costing the goal beside the money, so
          the page opens on the same trade-off every row below repeats. */}
      <Card className="flex flex-wrap items-end gap-x-9 gap-y-5 p-5">
        <div className="flex flex-col gap-0.5">
          <span className="text-xs font-semibold uppercase tracking-[0.07em] text-text-3">
            {summary.left < 0 ? "Over budget" : ctx.phase === "past" ? "Left unspent" : "Left to spend"}
          </span>
          <span className={cn("font-display text-[30px] leading-tight tabular money", summary.left < 0 ? "text-negative" : "text-text")}>
            {fmt(Math.abs(summary.left))}
          </span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-xs font-semibold uppercase tracking-[0.07em] text-text-3">Spent</span>
          <span className="font-display text-[30px] leading-tight tabular money text-text">{fmt(summary.spent)}</span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-xs font-semibold uppercase tracking-[0.07em] text-text-3">Budgeted</span>
          <span className="font-display text-[30px] leading-tight tabular money text-text-3">{fmt(summary.budgeted)}</span>
        </div>
        {costingDays != null && (
          <div className="flex flex-col gap-0.5">
            <span className="text-xs font-semibold uppercase tracking-[0.07em] text-text-3">Costing the goal</span>
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
          {current ? (
            <span className="flex items-center gap-2 text-[13px] text-text-3">
              <span className="h-3.5 w-0.5 rounded-full bg-text" aria-hidden="true" />
              marks today
            </span>
          ) : (
            <span className="text-[13px] text-text-3">Pick a row to edit it</span>
          )}
        </div>

        {rows.map(({ line, available, r, status }) => (
          <button
            key={line.categoryId}
            type="button"
            onClick={() => setOpenId(line.categoryId)}
            className={cn(
              "grid w-full gap-x-7 gap-y-3 border-t border-border px-5 py-4 text-left hover:bg-surface-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-info",
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

            <span className="flex flex-col gap-2">
              {/* What's spent, as a share of the budget, with today marked:
                  a fill past the mark is spending ahead of the month. */}
              <span className="relative block h-2 rounded-full bg-sunken" aria-hidden="true">
                <span className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${status.spentPct * 100}%`, background: toneFill(status.tone, line.colorSlot) }} />
                {current && <span className="absolute -inset-y-1 w-0.5 rounded-full bg-text" style={{ left: `${r.todayPct * 100}%` }} />}
              </span>
              <span className="text-[13px] tabular">
                <span className={TONE_TEXT[status.tone]}>{status.text}</span>
                {status.cost && <span className="text-negative">{status.cost}</span>}
              </span>
            </span>

            <span className="flex flex-col lg:items-end">
              <span className={cn("font-display text-[23px] leading-tight tabular money", r.left < 0 ? "text-negative" : "text-text")}>
                {r.left < 0 ? `−${fmt(-r.left)}` : fmt(r.left)}
              </span>
              <span className="font-mono text-[11px] leading-snug tabular money text-text-3">
                {r.left < 0 ? `${formatCents(line.spend)} of ${formatCents(available)}` : `of ${formatCents(available)}`}
              </span>
            </span>
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
