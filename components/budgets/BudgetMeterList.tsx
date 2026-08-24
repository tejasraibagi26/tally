import Link from "next/link";
import { PiggyBank } from "lucide-react";
import { formatCents } from "@/lib/money";
import { computeBurnRateProjection } from "@/lib/budgetMath";
import { EmptyState } from "@/components/ui/EmptyState";
import type { BudgetLine } from "@/lib/budgets";

// Read-only condensed meter list for the Overview screen (DESIGN.md §10 "Budget this month" panel) —
// the editable version with add/edit/remove lives on the full /budgets page. Overview is always the
// current month, so daysElapsed/daysInMonth (for the projection marker) are always meaningful here.
export function BudgetMeterList({
  budgets,
  from,
  to,
  daysElapsed,
  daysInMonth,
}: {
  budgets: BudgetLine[];
  from: string;
  to: string;
  daysElapsed: number;
  daysInMonth: number;
}) {
  if (budgets.length === 0) {
    return (
      <div className="px-4 py-8">
        <EmptyState
          icon={PiggyBank}
          compact
          title="No budgets set for this month yet"
          action={
            <Link href="/budgets" className="text-brand text-[13.5px]">
              Set a budget →
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 p-4">
      {budgets.map((b) => {
        const totalAvailable = b.amount + b.rolloverFromPrior;
        const pct = totalAvailable > 0 ? Math.min(1, b.spend / totalAvailable) : b.spend > 0 ? 1 : 0;
        const overBudget = b.remaining < 0;
        // See BudgetRow.tsx: a fixed monthly charge (rent, insurance) posts
        // once rather than accruing daily, so this linear extrapolation
        // doesn't apply to it.
        const projected = b.isFixedAmount ? null : computeBurnRateProjection(b.spend, daysElapsed, daysInMonth);
        const projectedPct = projected != null && totalAvailable > 0 ? Math.min(1, projected / totalAvailable) : null;
        return (
          <Link
            key={b.categoryId}
            href={`/transactions?category=${b.categoryId}&from=${from}&to=${to}&transfer=0&excluded=0`}
            className="flex flex-col gap-1.5 group"
          >
            <div className="flex items-center justify-between text-[13.5px]">
              <span className="text-text group-hover:text-brand transition-colors">{b.categoryName}</span>
              <span className={overBudget ? "text-negative tabular money" : "text-text-2 tabular money"}>
                {overBudget ? `${formatCents(Math.abs(b.remaining))} over` : `${formatCents(b.remaining)} left`}
              </span>
            </div>
            <div className="relative h-2 rounded-full bg-sunken overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{ width: `${pct * 100}%`, background: overBudget ? "var(--negative)" : `var(--series-${b.categoryColorSlot})` }}
              />
              {projected != null && projectedPct != null && (
                <div
                  className="absolute top-0 bottom-0 w-0 border-l-2 border-dashed border-text-3"
                  style={{ left: `${projectedPct * 100}%` }}
                  title={`Projected ${formatCents(projected)} by month end`}
                />
              )}
            </div>
          </Link>
        );
      })}
    </div>
  );
}
