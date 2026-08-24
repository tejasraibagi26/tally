/** A day-of-month anchor: 1-31, or 0 meaning "the last day of the month." */
export type DayAnchor = number;

export const DEFAULT_SEMI_MONTHLY_ANCHORS: DayAnchor[] = [15, 0];

/**
 * Resolves one anchor to an actual "YYYY-MM-DD" date for a given month,
 * clamping to the month's real last day (so anchor 31 in a 30-day month
 * still lands somewhere sane) and shifting a weekend landing back to the
 * preceding Friday — Saturday moves back 1 day, Sunday back 2.
 */
export function resolvePayDate(year: number, month0: number, anchor: DayAnchor): string {
  const daysInMonth = new Date(Date.UTC(year, month0 + 1, 0)).getUTCDate();
  const day = anchor === 0 ? daysInMonth : Math.min(anchor, daysInMonth);
  const date = new Date(Date.UTC(year, month0, day));
  const dow = date.getUTCDay(); // 0 Sun .. 6 Sat
  if (dow === 6) date.setUTCDate(date.getUTCDate() - 1);
  else if (dow === 0) date.setUTCDate(date.getUTCDate() - 2);
  return date.toISOString().slice(0, 10);
}

/** Every anchor resolved for one month, deduplicated and sorted. */
export function payDatesForMonth(year: number, month0: number, anchors: DayAnchor[]): string[] {
  return [...new Set(anchors.map((a) => resolvePayDate(year, month0, a)))].sort();
}

/**
 * Every resolved pay date at or before `throughDate`, scanning back from the
 * month containing it through `monthsBack` prior months — a small catch-up
 * window so a schedule created mid-month (or a missed cron run) still picks
 * up a payday that already passed, not just ones still ahead.
 */
export function duePayDates(anchors: DayAnchor[], throughDate: string, monthsBack = 1): string[] {
  const through = new Date(throughDate + "T00:00:00Z");
  const dates: string[] = [];
  for (let back = monthsBack; back >= 0; back--) {
    const d = new Date(Date.UTC(through.getUTCFullYear(), through.getUTCMonth() - back, 1));
    dates.push(...payDatesForMonth(d.getUTCFullYear(), d.getUTCMonth(), anchors));
  }
  return dates.filter((d) => d <= throughDate).sort();
}
