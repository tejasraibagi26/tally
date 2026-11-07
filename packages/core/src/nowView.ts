/**
 * The new "Now" home (web /new): pure helpers behind its answers -- can I
 * afford this, how has my net worth moved, how are my budgets doing -- kept
 * here so mobile can say the same thing about the same numbers later.
 *
 * Money is integer cents throughout.
 */

import { budgetRowState, type BudgetLineInput, type MonthContext } from "./budgetView";

// ── can I afford it ────────────────────────────────────────────────────────

/** Within this much of the buffer counts as "tight" rather than "fine". */
export const TIGHT_MARGIN_CENTS = 25_000;

export type AffordStatus = "fine" | "tight" | "short";

export interface AffordDay {
  date: string;
  balance: number;
}

export interface AffordResult {
  status: AffordStatus;
  /** The lowest the balance gets with the purchase taken off today. */
  low: { date: string; amount: number };
  /**
   * Short only: the first day from which buying it keeps every later day at
   * or above the buffer. Null when no day in the window works.
   */
  waitUntil: string | null;
}

/**
 * Takes `amount` off every projected day (bought today) and grades the
 * lowest point against the user's buffer: under it is short, within
 * TIGHT_MARGIN_CENTS of it is tight. With no projection there is nothing to
 * grade, so the answer is null.
 */
export function affordCheck(days: AffordDay[], amount: number, cushion: number): AffordResult | null {
  if (days.length === 0) return null;
  const spend = Math.max(0, amount);

  let low = { date: days[0]!.date, amount: days[0]!.balance - spend };
  for (const d of days) {
    if (d.balance - spend < low.amount) low = { date: d.date, amount: d.balance - spend };
  }

  const status: AffordStatus = low.amount < cushion ? "short" : low.amount < cushion + TIGHT_MARGIN_CENTS ? "tight" : "fine";

  let waitUntil: string | null = null;
  if (status === "short") {
    // Walk back from the end: the run of days that all stay above the buffer.
    let start = days.length;
    for (let i = days.length - 1; i >= 0; i--) {
      if (days[i]!.balance - spend >= cushion) start = i;
      else break;
    }
    // Index 0 would mean today works, which contradicts "short".
    waitUntil = start > 0 && start < days.length ? days[start]!.date : null;
  }

  return { status, low, waitUntil };
}

// ── net worth movement ─────────────────────────────────────────────────────

export interface NetPoint {
  asOfDate: string;
  net: number;
}

export interface NetWorthChange {
  /** Since the last snapshot before this month began ("since Oct 31"). */
  month: { amount: number; since: string } | null;
  /** Since the oldest snapshot, when it's at least ~10 months back. */
  year: { amount: number; since: string } | null;
}

/** How old the oldest snapshot must be before we call the change "this year". */
const YEAR_MIN_DAYS = 300;

/** `points` ascending by date; `current` is today's live figure. */
export function netWorthChange(points: NetPoint[], current: number, today: string): NetWorthChange {
  const monthStart = `${today.slice(0, 7)}-01`;
  const before = [...points].reverse().find((p) => p.asOfDate < monthStart);
  const first = points[0];
  const ageDays = first ? (Date.parse(`${today}T00:00:00Z`) - Date.parse(`${first.asOfDate}T00:00:00Z`)) / 86_400_000 : 0;
  return {
    month: before ? { amount: current - before.net, since: before.asOfDate } : null,
    year: first && ageDays >= YEAR_MIN_DAYS ? { amount: current - first.net, since: first.asOfDate } : null,
  };
}

// ── budgets at a glance ────────────────────────────────────────────────────

export type BudgetMood = "over" | "close" | "fine" | "fixed";

export interface BudgetTallyLine extends BudgetLineInput {
  name: string;
}

/** Over its money; close (80%+ used, or ahead of pace); fine; or a fixed bill. */
export function budgetMood(line: BudgetLineInput, ctx: MonthContext): BudgetMood {
  if (line.isFixedAmount) return "fixed";
  const available = line.amount + line.rolloverFromPrior;
  if (line.spend > available) return "over";
  const row = budgetRowState(line, ctx, () => "");
  return row.barTone === "warning" || row.aheadOfPace || row.projected != null ? "close" : "fine";
}

export interface BudgetTally {
  over: string[];
  close: string[];
  fine: number;
  /** Everyday (non-fixed) budgets. */
  total: number;
}

export function budgetTally(lines: BudgetTallyLine[], ctx: MonthContext): BudgetTally {
  const out: BudgetTally = { over: [], close: [], fine: 0, total: 0 };
  for (const l of lines) {
    const mood = budgetMood(l, ctx);
    if (mood === "fixed") continue;
    out.total++;
    if (mood === "over") out.over.push(l.name);
    else if (mood === "close") out.close.push(l.name);
    else out.fine++;
  }
  return out;
}

// ── drawing ────────────────────────────────────────────────────────────────

/**
 * SVG polyline points for `values` across a `width` × `height` box, inside
 * `pad` px top and bottom. `range` pins the scale (so a goal line or a $0
 * line can share it); otherwise it's the values' own min and max.
 */
export function linePoints(values: number[], width: number, height: number, pad = 8, range?: { min: number; max: number }): string {
  if (values.length === 0) return "";
  const min = range?.min ?? Math.min(...values);
  const max = range?.max ?? Math.max(...values);
  const span = max - min || 1;
  const step = values.length > 1 ? width / (values.length - 1) : 0;
  return values
    .map((v, i) => `${(i * step).toFixed(1)},${(pad + (1 - (v - min) / span) * (height - pad * 2)).toFixed(1)}`)
    .join(" ");
}

/** The y for `value` on the same scale linePoints draws with. */
export function yFor(value: number, height: number, range: { min: number; max: number }, pad = 8): number {
  const span = range.max - range.min || 1;
  return pad + (1 - (value - range.min) / span) * (height - pad * 2);
}
