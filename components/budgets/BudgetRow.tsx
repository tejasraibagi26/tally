"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { formatCents } from "@/lib/money";
import { monthLastDay, computeBurnRateProjection } from "@/lib/budgetMath";
import { cn } from "@/lib/cn";

export interface BudgetRowData {
  categoryId: string;
  categoryName: string;
  categoryColorSlot: number;
  month: string;
  amount: number;
  rolloverEnabled: boolean;
  rolloverFromPrior: number;
  spend: number;
  remaining: number;
}

/** `daysElapsed`/`daysInMonth` are only passed for the current month — projecting a past or future month doesn't mean anything (WORK.md §9). */
export function BudgetRow({ budget, daysElapsed, daysInMonth }: { budget: BudgetRowData; daysElapsed?: number; daysInMonth?: number }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [amountInput, setAmountInput] = useState((budget.amount / 100).toFixed(2));
  const [rollover, setRollover] = useState(budget.rolloverEnabled);
  const [saving, setSaving] = useState(false);

  const totalAvailable = budget.amount + budget.rolloverFromPrior;
  const pct = totalAvailable > 0 ? Math.min(1, budget.spend / totalAvailable) : budget.spend > 0 ? 1 : 0;
  const overBudget = budget.remaining < 0;
  const barColor = overBudget ? "bg-negative" : pct >= 0.8 ? "bg-warning" : "bg-positive";

  const projected = daysElapsed && daysInMonth ? computeBurnRateProjection(budget.spend, daysElapsed, daysInMonth) : null;
  const projectedPct = projected != null && totalAvailable > 0 ? Math.min(1, projected / totalAvailable) : null;
  const projectedOver = projected != null && projected > totalAvailable;

  async function save() {
    const amount = Math.round(parseFloat(amountInput) * 100);
    if (!Number.isFinite(amount) || amount < 0) return;
    setSaving(true);
    try {
      const res = await fetch("/api/budgets", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ month: budget.month, categoryId: budget.categoryId, amount, rolloverEnabled: rollover }),
      });
      if (!res.ok) throw new Error("Failed to save budget");
      setEditing(false);
      router.refresh();
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!window.confirm(`Remove the ${budget.categoryName} budget for this month?`)) return;
    setSaving(true);
    try {
      const res = await fetch("/api/budgets", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ month: budget.month, categoryId: budget.categoryId }),
      });
      if (!res.ok) throw new Error("Failed to remove budget");
      router.refresh();
    } catch (err) {
      console.error(err);
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-2 px-4 py-3 border-b border-border last:border-b-0">
      <div className="flex items-center gap-3">
        <span className="w-1.5 h-1.5 rounded-full flex-none" style={{ background: `var(--series-${budget.categoryColorSlot})` }} />
        <span className="text-[15px] text-text flex-1 min-w-0 truncate">{budget.categoryName}</span>
        {budget.rolloverEnabled && budget.rolloverFromPrior !== 0 && (
          <span className="text-xs text-text-3 tabular">+{formatCents(budget.rolloverFromPrior)} rollover</span>
        )}

        {editing ? (
          <div className="flex items-center gap-2">
            <span className="text-text-3 text-sm">$</span>
            <input
              type="number"
              step="0.01"
              min="0"
              value={amountInput}
              onChange={(e) => setAmountInput(e.target.value)}
              className="w-24 h-8 rounded-control bg-surface-2 border border-border-strong px-2 text-sm text-text tabular"
              autoFocus
            />
            <label className="flex items-center gap-1 text-xs text-text-2">
              <input type="checkbox" checked={rollover} onChange={(e) => setRollover(e.target.checked)} />
              Rollover
            </label>
            <button
              onClick={save}
              disabled={saving}
              className="h-8 px-2.5 rounded-control bg-brand text-on-brand text-xs font-medium disabled:opacity-40"
            >
              Save
            </button>
            <button onClick={() => setEditing(false)} className="text-xs text-text-3 px-1">
              Cancel
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <span className={cn("text-[15px] tabular", overBudget ? "text-negative" : "text-text")}>
              {formatCents(budget.remaining)} left
            </span>
            <span className="text-xs text-text-3 tabular">of {formatCents(budget.amount)}</span>
            <Link
              href={`/transactions?category=${budget.categoryId}&from=${budget.month}&to=${monthLastDay(budget.month)}&transfer=0&excluded=0`}
              className="text-xs text-brand"
            >
              View
            </Link>
            <button onClick={() => setEditing(true)} className="text-xs text-brand">
              Edit
            </button>
            <button onClick={remove} disabled={saving} className="text-xs text-text-3 hover:text-negative disabled:opacity-40">
              Remove
            </button>
          </div>
        )}
      </div>

      <div className="relative h-1.5 rounded-full bg-sunken overflow-hidden">
        <div className={cn("h-full rounded-full transition-[width]", barColor)} style={{ width: `${pct * 100}%` }} />
        {projectedPct != null && (
          <div
            className="absolute top-0 bottom-0 w-0 border-l-2 border-dashed border-text-3"
            style={{ left: `${projectedPct * 100}%` }}
            title={`Projected ${formatCents(projected!)} by month end`}
          />
        )}
      </div>
      <div className="flex items-center justify-between">
        <span className="text-xs text-text-3 tabular">{formatCents(budget.spend)} spent</span>
        {projected != null && (
          <span className={cn("text-xs tabular", projectedOver ? "text-warning" : "text-text-3")}>
            Projected {formatCents(projected)} by month end
          </span>
        )}
      </div>
    </div>
  );
}
