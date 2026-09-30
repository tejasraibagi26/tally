/** Pure budget-month arithmetic — no DB import, so it's testable without Postgres. */

/** `month` is always the 1st of the month, "YYYY-MM-01" (matches `budgets.month`'s date column). */
export function monthRange(month: string): { start: string; end: string } {
  const start = new Date(month + "T00:00:00Z");
  const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1));
  return { start: month, end: end.toISOString().slice(0, 10) };
}

/** Last calendar day of `month`, inclusive — for building an inclusive `to=` filter (transactions page uses `lte`), unlike monthRange's exclusive `end`. */
export function monthLastDay(month: string): string {
  const start = new Date(month + "T00:00:00Z");
  const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0));
  return end.toISOString().slice(0, 10);
}

export function shiftMonth(month: string, deltaMonths: number): string {
  const d = new Date(month + "T00:00:00Z");
  const shifted = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + deltaMonths, 1));
  return shifted.toISOString().slice(0, 10);
}

/**
 * §9 "Budget remaining": `amount − spend(category, month)` plus rollover.
 * Never clamped to zero — an over-budget category should read negative.
 */
export function computeRemaining(amount: number, rolloverFromPrior: number, spend: number): number {
  return amount + rolloverFromPrior - spend;
}

/** §9 "Burn rate / projection": spend_to_date / days_elapsed × days_in_month. Callers must label the result "projected" — this just does the arithmetic. */
export function computeBurnRateProjection(spendToDate: number, daysElapsed: number, daysInMonth: number): number {
  if (daysElapsed <= 0) return 0;
  return Math.round((spendToDate / daysElapsed) * daysInMonth);
}

/**
 * A distinct chart color (series slot 1..8) per budget. A budget's category
 * colorSlot comes from its parent category (lib/categoryTaxonomy.ts), so
 * sibling budgets -- Groceries and Dining out are both "Food and drink" --
 * shared one color and were indistinguishable in meters and the stacked
 * budget bar. Slots are dealt out in alphabetical order of category name
 * rather than list order: the budget list is sorted by spend, which would
 * reshuffle colors every time spending changed. Wraps past 8 budgets.
 */
export function budgetColorSlots(budgets: { categoryId: string; categoryName: string }[]): Map<string, number> {
  const sorted = [...budgets].sort((a, b) => a.categoryName.localeCompare(b.categoryName) || a.categoryId.localeCompare(b.categoryId));
  return new Map(sorted.map((b, i) => [b.categoryId, (i % 8) + 1]));
}

/** `date` (YYYY-MM-DD) moved by whole months, keeping its day -- clamped to the target month's last day (Aug 31 + 6 → Feb 28/29). */
export function shiftDateByMonths(date: string, deltaMonths: number): string {
  const d = new Date(date + "T00:00:00Z");
  const target = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + deltaMonths, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(d.getUTCDate(), lastDay));
  return target.toISOString().slice(0, 10);
}
