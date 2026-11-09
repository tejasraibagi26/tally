/**
 * The goal view's one-line budget status (web Budgets, goal view): a tone
 * that colours the bar and a short line under it, like "On track · lasts the
 * month" or "Over by $24 · cost the goal 1.3 days".
 *
 * Built on budgetRunway's verdict (so "ahead of pace" means exactly what the
 * runway means by running out early) and goalCost's days, but says it in one
 * short line instead of the runway's two sentences. The goal cost only
 * appears when there is one, so most rows carry nothing in red.
 *
 * Pure: callers format money through `formatMoney`, like budgetRunway.
 */
import type { Runway } from "./budgetRunway";
import type { GoalCost } from "./goalCost";

/** ok: within pace · ahead: spending faster than the month allows · over: past the budget · settled: fixed, or not this month. */
export type BudgetTone = "ok" | "ahead" | "over" | "settled";

export interface BudgetStatus {
  tone: BudgetTone;
  /** 0..1 of the budget spent: the bar's fill. */
  spentPct: number;
  /** The plain status, e.g. "Ahead of pace · runs out around Nov 20". */
  text: string;
  /** What it costs the goal, e.g. " · cost the goal 1.3 days". Empty when nothing. */
  cost: string;
}

/** "Nov" from "2026-11-01". */
function monthShort(month: string): string {
  return new Date(`${month.slice(0, 7)}-01T00:00:00Z`).toLocaleDateString("en-US", { month: "short", timeZone: "UTC" });
}

function days(n: number): string {
  const v = n === Math.round(n) ? String(n) : n.toFixed(1);
  return `${v} ${n === 1 ? "day" : "days"}`;
}

/** The goal cost as a suffix: days already given away, else what the pace will cost. */
export function goalCostSuffix(cost: GoalCost): string {
  if (cost.kind === "none") return "";
  if (cost.days) return ` · cost the goal ${days(cost.days)}`;
  if (cost.projectedDays) return ` · ${days(cost.projectedDays)} off the goal at this rate`;
  return "";
}

export function budgetStatus(
  input: { available: number; spend: number; month: string },
  runway: Runway,
  cost: GoalCost,
  formatMoney: (cents: number) => string,
): BudgetStatus {
  const { available, spend, month } = input;
  const spentPct = available > 0 ? Math.max(0, Math.min(1, spend / available)) : spend > 0 ? 1 : 0;
  const over = spend - available;
  const suffix = goalCostSuffix(cost);

  switch (runway.state) {
    case "over":
      return { tone: "over", spentPct, text: `Over by ${formatMoney(over)}`, cost: suffix };
    case "fixed":
      return {
        tone: "settled",
        spentPct,
        text: spend >= available ? "Paid" : spend > 0 ? `${formatMoney(spend)} of ${formatMoney(available)} paid` : "Not paid yet",
        cost: "",
      };
    case "not_current":
      return over > 0
        ? { tone: "over", spentPct, text: `Over by ${formatMoney(over)}`, cost: suffix }
        : { tone: "settled", spentPct, text: spend > 0 ? `${formatMoney(spend)} spent` : "Nothing spent", cost: "" };
    case "untouched":
      return { tone: "ok", spentPct, text: "Nothing spent yet", cost: "" };
    case "carries":
      return { tone: "ok", spentPct, text: "On track · lasts the month", cost: suffix };
    case "lands_short":
    case "runs_dry":
      return {
        tone: "ahead",
        spentPct,
        text: `Ahead of pace · runs out around ${monthShort(month)} ${runway.runsOutDay}`,
        cost: suffix,
      };
  }
}
