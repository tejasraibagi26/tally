import Link from "next/link";
import { formatCents } from "@tally/core/money";
import { goalCostTotal } from "@tally/core/goalCost";
import { computeBurnRateProjection } from "@tally/core/budgetMath";
import type { BudgetLine } from "@/lib/budgets";
import type { GoalSummary } from "@/lib/goals";
import { deadlineLabel } from "@/lib/goalCopy";
import { cn } from "@/lib/cn";

function M({ cents }: { cents: number }) {
  return (
    <span className="money money-fit">
      <span>{formatCents(Math.round(cents)).replace(/\.00$/, "")}</span>
    </span>
  );
}

function daysLabel(days: number): string {
  const n = days === Math.round(days) ? String(days) : days.toFixed(1);
  return `${n} ${days === 1 ? "day" : "days"}`;
}

/**
 * The Budgets header's one line on the goal view: what the month's overspend
 * has already cost the goal, and what it reaches if the pace holds.
 *
 * Replaces GoalBudgetLine's projection wording, which the Overview hero now
 * carries, so the same verdict is not printed on both pages.
 */
export function GoalCostSummary({
  budgets,
  summary,
  daysInMonth,
  daysElapsed,
  className,
}: {
  budgets: BudgetLine[];
  summary: GoalSummary | null;
  daysInMonth: number;
  daysElapsed?: number;
  className?: string;
}) {
  const needed = summary?.projection.neededPerMonth ?? null;
  if (budgets.length === 0) return null;

  const overs = budgets.map((b) => b.spend - (b.amount + b.rolloverFromPrior));
  const projectedOvers = budgets.map((b) => {
    if (b.isFixedAmount || daysElapsed == null) return 0;
    return computeBurnRateProjection(b.spend, daysElapsed, daysInMonth) - (b.amount + b.rolloverFromPrior);
  });
  const now = goalCostTotal(overs, needed, daysInMonth);
  const projected = goalCostTotal(projectedOvers, needed, daysInMonth);
  const dailyNeedCents = needed != null ? needed / daysInMonth : null;

  if (needed == null || dailyNeedCents == null) {
    return (
      <p className={cn("m-0 text-[13.5px] text-text-2", className)}>
        <Link href="/goals" className="font-medium text-brand">
          Set a goal for the year
        </Link>{" "}
        and every budget here starts saying what going over costs you.
      </p>
    );
  }

  if (!now && !projected) {
    return (
      <p className={cn("m-0 text-[13.5px] text-text-2 tabular", className)}>
        Nothing here is costing your goal. Every budget is inside its pace, and your goal needs{" "}
        <M cents={dailyNeedCents} /> a day saved to land by {deadlineLabel(summary!.goal.deadline)}.
      </p>
    );
  }

  return (
    <p className={cn("m-0 text-[13.5px] text-text-2 tabular", className)}>
      {now ? (
        <>
          Going over has cost <span className="font-semibold text-negative">{daysLabel(now)}</span> of goal progress so far
        </>
      ) : (
        <>Nothing is over yet</>
      )}
      , at the <M cents={dailyNeedCents} /> a day your goal needs.
      {projected && projected > (now ?? 0) ? <> Holding this pace to month end makes it {daysLabel(projected)}.</> : null}
    </p>
  );
}
