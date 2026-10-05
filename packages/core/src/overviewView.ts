/**
 * Pure rules behind the mobile Overview screen: how a bill's due date reads,
 * how a recent-activity row dates itself, which budgets surface, the
 * net-worth range slice and its delta, and the credit-utilization band.
 * Callers pass "today" as YYYY-MM-DD in the user's zone so nothing here
 * reads the clock.
 */

const DAY_MS = 86_400_000;

function dayDiff(from: string, to: string): number {
  return Math.round((new Date(`${to}T00:00:00Z`).getTime() - new Date(`${from}T00:00:00Z`).getTime()) / DAY_MS);
}

export interface DueLabel {
  /** "Due today", "tomorrow", "in 3 days", "Overdue". */
  text: string;
  /** Due today or already past: shown in the warning color, with the words carrying the meaning. */
  urgent: boolean;
  /** Due within a week: slightly stronger than the usual muted sub line. */
  soon: boolean;
}

export function dueLabel(dueDate: string, today: string): DueLabel {
  const n = dayDiff(today, dueDate);
  if (n < 0) return { text: "Overdue", urgent: true, soon: true };
  if (n === 0) return { text: "Due today", urgent: true, soon: true };
  if (n === 1) return { text: "tomorrow", urgent: false, soon: true };
  return { text: `in ${n} days`, urgent: false, soon: n <= 7 };
}

/** The date tile's two lines: "OCT" over "15". */
export function dateTile(date: string): { month: string; day: string } {
  const d = new Date(`${date}T00:00:00Z`);
  return {
    month: d.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" }).toUpperCase(),
    day: String(d.getUTCDate()),
  };
}

/** "Today", "Yesterday", "Oct 12", or "Dec 29, 2025" for a different year. */
export function shortDayLabel(date: string, today: string): string {
  const n = dayDiff(date, today);
  if (n === 0) return "Today";
  if (n === 1) return "Yesterday";
  const sameYear = date.slice(0, 4) === today.slice(0, 4);
  return new Date(`${date}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC", ...(sameYear ? {} : { year: "numeric" }) });
}

export interface RankableBudget {
  amount: number;
  rolloverFromPrior: number;
  isFixedAmount: boolean;
  spend: number;
}

/**
 * The budgets worth a glance, most at-risk first: highest share used, ties
 * broken by budget size. A fixed-amount budget that has already been paid
 * (rent, insurance) is done, not at risk, so it never takes a slot.
 */
export function rankBudgets<T extends RankableBudget>(lines: T[], limit: number): T[] {
  const available = (l: T) => l.amount + l.rolloverFromPrior;
  const used = (l: T) => (available(l) > 0 ? l.spend / available(l) : l.spend > 0 ? Infinity : 0);
  return lines
    .filter((l) => !(l.isFixedAmount && l.spend >= available(l)))
    .sort((a, b) => used(b) - used(a) || available(b) - available(a))
    .slice(0, limit);
}

export type NetWorthRange = "1M" | "3M" | "6M" | "1Y";
export const NET_WORTH_RANGES: NetWorthRange[] = ["1M", "3M", "6M", "1Y"];
const RANGE_MONTHS: Record<NetWorthRange, number> = { "1M": 1, "3M": 3, "6M": 6, "1Y": 12 };
export const RANGE_CAPTION: Record<NetWorthRange, string> = { "1M": "Past month", "3M": "Past 3 months", "6M": "Past 6 months", "1Y": "Past year" };

/** YYYY-MM-DD, `months` calendar months before `today` (day clamped to the month's length). */
export function monthsAgo(today: string, months: number): string {
  const y = Number(today.slice(0, 4));
  const m = Number(today.slice(5, 7)) - 1;
  const d = Number(today.slice(8, 10));
  const target = new Date(Date.UTC(y, m - months, 1));
  const last = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(d, last));
  return target.toISOString().slice(0, 10);
}

export interface TrendPoint {
  asOfDate: string;
  net: number;
}

/** The part of the daily series inside the range (cutoff day included). */
export function sliceNetWorthRange<T extends TrendPoint>(points: T[], range: NetWorthRange, today: string): T[] {
  const cutoff = monthsAgo(today, RANGE_MONTHS[range]);
  return points.filter((p) => p.asOfDate >= cutoff);
}

export interface NetWorthDelta {
  direction: "up" | "down";
  /** Absolute change in cents. */
  cents: number;
  /** Whole-number percent of the starting value. */
  pct: number;
}

/**
 * Change from the latest snapshot at or before the range's start to today's
 * live total (not the series' last point, which can lag a balance refresh).
 * Undefined when there's no snapshot that old, or it was zero, so the chip
 * never shows a misleading "0%".
 */
export function netWorthDelta(points: TrendPoint[], currentNet: number, range: NetWorthRange, today: string): NetWorthDelta | undefined {
  const cutoff = monthsAgo(today, RANGE_MONTHS[range]);
  const prior = [...points].reverse().find((p) => p.asOfDate <= cutoff)?.net;
  if (prior == null || prior === 0) return undefined;
  const change = currentNet - prior;
  return { direction: change >= 0 ? "up" : "down", cents: Math.abs(change), pct: Math.round((Math.abs(change) / Math.abs(prior)) * 100) };
}

export const CREDIT_UTILIZATION_LIMIT = 0.3;

/** Under 30% of the limit reads "Healthy"; at or over it reads "High". */
export function creditHealth(utilization: number): { label: "Healthy" | "High"; tone: "brand" | "warning" } {
  return utilization < CREDIT_UTILIZATION_LIMIT ? { label: "Healthy", tone: "brand" } : { label: "High", tone: "warning" };
}

/**
 * How sure the detector has to be before a guessed bill is listed. A stream
 * scores 0.7 x (1 - biggest gap wobble / 4 days) + 0.3 x (charges / 6), so 0.5
 * keeps three or more charges that land within about two days of each other
 * and drops loose three-charge patterns and lone annual pairs (capped at 0.4).
 */
export const MIN_UPCOMING_CONFIDENCE = 0.5;

export interface UpcomingStreamInput {
  /** The date it's expected: the user's override, else the detector's prediction. */
  dueDate: string | null;
  /** Added by the user rather than detected. */
  isManual: boolean;
  /** A due date the user set on the stream. */
  manualNextDueDate: string | null;
  status: string;
  /** Cents; negative is money out, positive is money in. */
  averageAmount: number;
  confidence: number | string | null;
}

/**
 * Whether a recurring stream belongs in Upcoming. A bill the user added, or
 * whose due date they set, is theirs to vouch for and only has to be in the
 * window. A detected one must also be active, be spending (a paycheck, bonus
 * or refund is never a bill) and clear MIN_UPCOMING_CONFIDENCE. `today` and
 * `cutoff` are YYYY-MM-DD, both inclusive.
 */
export function qualifiesAsUpcoming(s: UpcomingStreamInput, today: string, cutoff: string): boolean {
  if (s.dueDate == null || s.dueDate < today || s.dueDate > cutoff) return false;
  if (s.isManual || s.manualNextDueDate != null) return true;
  if (s.status !== "active") return false;
  return s.averageAmount < 0 && Number(s.confidence ?? 0) >= MIN_UPCOMING_CONFIDENCE;
}
