/**
 * What spending costs the year-end goal, in days.
 *
 * The goal needs `neededPerMonth` (@tally/core/goalMath) saved every month to
 * land on target. Divide that by the days in the month and you have what a
 * day of progress is worth; divide an overage by that and you have how many
 * days of progress the overage just gave away.
 *
 * Deliberately plain arithmetic, no risk model: if the target changes, the
 * number changes with it, which is the behaviour someone can check by hand.
 * Pure -- callers format money through `formatMoney`.
 */

/** What one day of goal progress is worth, in cents. Null without a live goal. */
export function dailyNeed(neededPerMonth: number | null, daysInMonth: number): number | null {
  if (neededPerMonth == null || neededPerMonth <= 0 || daysInMonth <= 0) return null;
  return neededPerMonth / daysInMonth;
}

/**
 * Days of goal progress `over` cents of overspend costs, to one decimal.
 * Null when there is nothing to price it against, 0 when nothing is over.
 */
export function goalCostDays(over: number, need: number | null): number | null {
  if (need == null || need <= 0) return null;
  if (over <= 0) return 0;
  return Math.round((over / need) * 10) / 10;
}

/** Whether an overage is one charge that happened or a pace that will keep going. */
export type OverKind = "none" | "one_off" | "rate";

export interface GoalCost {
  kind: OverKind;
  /** Days already given away. Null when it can't be priced, 0 when nothing is over. */
  days: number | null;
  /** Days it reaches by month end if the pace holds. Only set for a rate. */
  projectedDays: number | null;
  /** "1.3 days", or null when there is nothing to show. */
  label: string | null;
  /** The qualifier under the label: "one-off, not a rate", "and 5.7 at this rate". */
  note: string | null;
}

const NONE: GoalCost = { kind: "none", days: 0, projectedDays: null, label: null, note: null };

function daysLabel(days: number): string {
  return `${days === Math.round(days) ? days : days.toFixed(1)} ${days === 1 ? "day" : "days"}`;
}

/**
 * Prices one budget row against the goal.
 *
 * `over` is what it is over right now (0 when inside the budget).
 * `projectedOver` is what it would be over by month end at the current rate
 * (budgetView's `projected` minus the budget), which is what separates a
 * habit from a one-time bill.
 */
export function goalCost(input: {
  over: number;
  projectedOver?: number | null;
  neededPerMonth: number | null;
  daysInMonth: number;
}): GoalCost {
  const need = dailyNeed(input.neededPerMonth, input.daysInMonth);
  if (need == null) return { ...NONE, days: null };

  const days = goalCostDays(input.over, need);
  const projectedDays = input.projectedOver != null && input.projectedOver > input.over ? goalCostDays(input.projectedOver, need) : null;

  if (!days) {
    // Inside the budget today, but on a pace that will break it.
    if (projectedDays) {
      return { kind: "rate", days: 0, projectedDays, label: null, note: `${daysLabel(projectedDays)} at this rate` };
    }
    return NONE;
  }

  if (projectedDays) {
    return { kind: "rate", days, projectedDays, label: daysLabel(days), note: `and ${projectedDays.toFixed(1)} at this rate` };
  }
  return { kind: "one_off", days, projectedDays: null, label: daysLabel(days), note: "one-off, not a rate" };
}

/** The month's total, for the Budgets header: "3.5 days". Null without a goal. */
export function goalCostTotal(overs: number[], neededPerMonth: number | null, daysInMonth: number): number | null {
  const need = dailyNeed(neededPerMonth, daysInMonth);
  if (need == null) return null;
  const total = overs.reduce((s, o) => s + Math.max(0, o), 0);
  return goalCostDays(total, need);
}
