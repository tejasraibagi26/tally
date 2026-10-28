/**
 * Finds the user's real, synced paycheque and predicts the next one (the
 * Safe to Spend spec, "Payday from your paycheques"). Pure: callers pass
 * income deposits and "today" (YYYY-MM-DD in the user's zone).
 *
 * Unlike recurringDetection's $1 amount band, a paycheque's amount moves
 * with overtime and tax, so deposits from one payer group within ±15% of
 * their median. Semi-monthly pay (the 15th and the last day) is predicted
 * from its day-of-month anchors with resolvePayDate, not by adding the
 * median gap, which would drift.
 */
import { resolvePayDate, type DayAnchor } from "./incomeScheduleMath";
import { ruleTargetFor } from "./rulesEngine";

export type PaychequeCadence = "weekly" | "biweekly" | "semimonthly" | "monthly";

export interface IncomeDeposit {
  id: string;
  accountId: string;
  merchantName: string | null;
  name: string;
  amount: number; // cents, positive
  date: string; // YYYY-MM-DD: the authorized date when there is one, else posted
}

export interface Paycheque {
  accountId: string;
  /** The payer as the UI names it: the merchant, or the description's kept words. */
  label: string;
  cadence: PaychequeCadence;
  /** Median of the last three deposits that fit. */
  amount: number;
  lastDate: string;
  nextDate: string;
  /** The last three deposits landed within PAYDAY_TOLERANCE_DAYS of where the cadence put them, and the next isn't overdue. */
  confident: boolean;
  depositIds: string[];
}

const AMOUNT_TOLERANCE = 0.15;
const PAYDAY_TOLERANCE_DAYS = 2;
const MIN_DEPOSITS = 3;

const DAY_MS = 86_400_000;
const toDay = (d: string) => Date.parse(`${d}T00:00:00Z`) / DAY_MS;
const fromDay = (n: number) => new Date(n * DAY_MS).toISOString().slice(0, 10);
const gapDays = (a: string, b: string) => toDay(b) - toDay(a);

function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}

function mode(values: number[]): number {
  const counts = new Map<number, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0]![0];
}

function dayOfMonth(date: string): number {
  return Number(date.slice(8, 10));
}

/** A day of month as an anchor: 26 or later reads as "the last day" (0), so Feb 28 and Mar 31 agree. */
function anchorOf(date: string): DayAnchor {
  return dayOfMonth(date) >= 26 ? 0 : dayOfMonth(date);
}

/** Every date the anchors resolve to, from the month before `from` through two months after. */
function anchorDates(anchors: DayAnchor[], from: string): string[] {
  const y = Number(from.slice(0, 4));
  const m = Number(from.slice(5, 7)) - 1;
  const dates: string[] = [];
  for (let k = -1; k <= 2; k++) {
    const d = new Date(Date.UTC(y, m + k, 1));
    for (const a of anchors) dates.push(resolvePayDate(d.getUTCFullYear(), d.getUTCMonth(), a));
  }
  return [...new Set(dates)].sort();
}

function nearestAnchorGap(date: string, anchors: DayAnchor[]): number {
  return Math.min(...anchorDates(anchors, date).map((d) => Math.abs(gapDays(d, date))));
}

function classify(dates: string[]): { cadence: PaychequeCadence; anchors: DayAnchor[] } | null {
  const gaps = dates.slice(1).map((d, i) => gapDays(dates[i]!, d));
  const g = median(gaps);
  const sameWeekday = new Set(dates.map((d) => new Date(`${d}T00:00:00Z`).getUTCDay())).size === 1;
  if (g >= 6 && g <= 8) return { cadence: "weekly", anchors: [] };
  if (g >= 13 && g <= 15 && sameWeekday) return { cadence: "biweekly", anchors: [] };
  if (g >= 12 && g <= 18) {
    const anchors = [...new Set(dates.map(anchorOf))];
    if (anchors.length > 2) {
      // Weekend shifts spread the days a little: keep the two most common.
      const counts = dates.map(anchorOf);
      const first = mode(counts);
      const second = mode(counts.filter((a) => a !== first));
      return { cadence: "semimonthly", anchors: [first, second] };
    }
    return { cadence: "semimonthly", anchors };
  }
  if (g >= 27 && g <= 33) return { cadence: "monthly", anchors: [mode(dates.map(anchorOf))] };
  return null;
}

function intervalDays(cadence: PaychequeCadence): number {
  return cadence === "weekly" ? 7 : 14;
}

/** The first payday after `last` the cadence puts next. */
function nextAfter(last: string, cadence: PaychequeCadence, anchors: DayAnchor[]): string {
  if (cadence === "weekly" || cadence === "biweekly") return fromDay(toDay(last) + intervalDays(cadence));
  // Strictly after last, and clear of last's own (possibly weekend-shifted) anchor date.
  return anchorDates(anchors, last).find((d) => gapDays(last, d) > PAYDAY_TOLERANCE_DAYS)!;
}

/** Did each of the last three deposits land where the cadence put it? */
function onTime(dates: string[], cadence: PaychequeCadence, anchors: DayAnchor[]): boolean {
  const recent = dates.slice(-MIN_DEPOSITS);
  if (cadence === "weekly" || cadence === "biweekly") {
    return recent.slice(1).every((d, i) => Math.abs(gapDays(recent[i]!, d) - intervalDays(cadence)) <= PAYDAY_TOLERANCE_DAYS);
  }
  return recent.every((d) => nearestAnchorGap(d, anchors) <= PAYDAY_TOLERANCE_DAYS);
}

/** Every payer with a steady cadence, most money a month first. */
export function detectPaycheques(deposits: IncomeDeposit[], today: string): Paycheque[] {
  const groups = new Map<string, { label: string; rows: IncomeDeposit[] }>();
  for (const d of deposits) {
    if (d.amount <= 0 || d.date > today) continue;
    const target = ruleTargetFor(d);
    const label = target?.label ?? d.name;
    const key = `${d.accountId}::${label.toLowerCase()}`;
    const g = groups.get(key) ?? { label, rows: [] };
    g.rows.push(d);
    groups.set(key, g);
  }

  const found: Paycheque[] = [];
  for (const { label, rows } of groups.values()) {
    const mid = median(rows.map((r) => r.amount));
    const fit = rows.filter((r) => Math.abs(r.amount - mid) <= mid * AMOUNT_TOLERANCE).sort((a, b) => a.date.localeCompare(b.date));
    // Two deposits on one day (a split cheque) count once.
    const byDate = fit.filter((r, i) => i === 0 || r.date !== fit[i - 1]!.date);
    if (byDate.length < MIN_DEPOSITS) continue;

    const recent = byDate.slice(-6);
    const dates = recent.map((r) => r.date);
    const shape = classify(dates);
    if (!shape) continue;

    const last = dates.at(-1)!;
    const nextDate = nextAfter(last, shape.cadence, shape.anchors);
    const overdue = gapDays(nextDate, today) > PAYDAY_TOLERANCE_DAYS;
    found.push({
      accountId: recent[0]!.accountId,
      label,
      cadence: shape.cadence,
      amount: Math.round(median(recent.slice(-MIN_DEPOSITS).map((r) => r.amount))),
      lastDate: last,
      nextDate,
      confident: onTime(dates, shape.cadence, shape.anchors) && !overdue,
      depositIds: recent.map((r) => r.id),
    });
  }

  const perMonth = (p: Paycheque) => p.amount * (p.cadence === "weekly" ? 52 / 12 : p.cadence === "biweekly" ? 26 / 12 : p.cadence === "semimonthly" ? 2 : 1);
  return found.sort((a, b) => perMonth(b) - perMonth(a));
}

/** The paycheque that sets payday: the biggest confident one. */
export function primaryPaycheque(found: Paycheque[]): Paycheque | null {
  return found.find((p) => p.confident) ?? null;
}

export const CADENCE_LABEL: Record<PaychequeCadence, string> = {
  weekly: "every week",
  biweekly: "every other week",
  semimonthly: "twice a month",
  monthly: "every month",
};
