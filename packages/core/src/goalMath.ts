/**
 * Year-end goals (Tally Pop only): one net worth target and a deadline,
 * projected from the pace net worth actually moved at. Shared by web,
 * mobile, the off-track alert and the monthly recap so they always agree.
 * Pure -- callers pass "today" as YYYY-MM-DD in the user's zone.
 */

const DAY_MS = 86_400_000;
/** Average days in a month, for turning day counts into months. */
const MONTH_DAYS = 365.25 / 12;
/** How many full months the pace averages over (fixed, no setting). */
export const PACE_MONTHS = 3;

function days(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS);
}

/** Months from today to the deadline, fractional; 0 once it has passed. */
export function monthsLeft(today: string, deadline: string): number {
  return Math.max(0, days(today, deadline) / MONTH_DAYS);
}

/** Dec 31 of today's year: the default deadline. */
export function defaultDeadline(today: string): string {
  return `${today.slice(0, 4)}-12-31`;
}

function lastDayOfMonth(month: string, back: number): string {
  // Last day of the month `back` months before `month`'s (YYYY-MM-..).
  const y = Number(month.slice(0, 4));
  const m = Number(month.slice(5, 7)) - 1 - back;
  return new Date(Date.UTC(y, m + 1, 0)).toISOString().slice(0, 10);
}

export interface NetWorthPointInput {
  asOfDate: string;
  net: number;
}

/**
 * Average monthly change in net worth over the last PACE_MONTHS full months:
 * net worth at the end of last month minus PACE_MONTHS months before that.
 * With less history, the change across what there is (at least 28 days),
 * scaled to a month. Null when there isn't enough to say.
 */
export function netWorthPace(points: NetWorthPointInput[], today: string): number | null {
  const sorted = [...points].sort((a, b) => a.asOfDate.localeCompare(b.asOfDate));
  const at = (date: string) => [...sorted].reverse().find((p) => p.asOfDate <= date);
  const end = at(lastDayOfMonth(today, 1));
  const start = at(lastDayOfMonth(today, 1 + PACE_MONTHS));
  if (end && start && days(start.asOfDate, end.asOfDate) >= 28 * PACE_MONTHS) {
    return (end.net - start.net) / PACE_MONTHS;
  }
  const first = sorted[0];
  const last = sorted.at(-1);
  if (!first || !last) return null;
  const span = days(first.asOfDate, last.asOfDate);
  if (span < 28) return null;
  return ((last.net - first.net) / span) * MONTH_DAYS;
}

/** Average income − spend over the last PACE_MONTHS full months (the saving part of the pace). */
export function savingPace(months: { month: string; income: number; spend: number }[], today: string): number | null {
  const current = `${today.slice(0, 7)}-01`;
  const full = months.filter((m) => m.month < current).slice(-PACE_MONTHS);
  if (full.length === 0) return null;
  return full.reduce((s, m) => s + (m.income - m.spend), 0) / full.length;
}

export type GoalStatus = "reached" | "on_track" | "off_track" | "unknown" | "ended";

export interface GoalProjection {
  current: number;
  target: number;
  /** target − current, never below 0. */
  gap: number;
  /** 0..1 of the way from the start value to the target. */
  progress: number;
  monthsLeft: number;
  /** What it takes from here: gap ÷ months left (null once the deadline passes). */
  neededPerMonth: number | null;
  /** Net worth's own monthly pace (null without enough history). */
  pace: number | null;
  /** The part of the pace that is income − spend; the rest is markets and debt paydown. */
  saving: number | null;
  /** current + pace × months left (null without a pace). */
  projected: number | null;
  status: GoalStatus;
  /** Off track: how much more per month closes the gap. */
  shortBy: number | null;
}

export function projectGoal(input: {
  target: number;
  start: number;
  current: number;
  deadline: string;
  today: string;
  pace: number | null;
  saving: number | null;
}): GoalProjection {
  const { target, start, current, deadline, today, pace, saving } = input;
  const left = monthsLeft(today, deadline);
  const gap = Math.max(0, target - current);
  const span = target - start;
  const progress = span > 0 ? Math.min(1, Math.max(0, (current - start) / span)) : current >= target ? 1 : 0;
  const projected = pace == null ? null : current + pace * left;
  const neededPerMonth = left > 0 ? gap / left : null;
  let status: GoalStatus;
  if (current >= target) status = "reached";
  else if (left === 0) status = "ended";
  else if (projected == null) status = "unknown";
  else status = projected >= target ? "on_track" : "off_track";
  const shortBy = status === "off_track" && neededPerMonth != null && pace != null ? Math.max(0, neededPerMonth - pace) : null;
  return { current, target, gap, progress, monthsLeft: left, neededPerMonth, pace, saving, projected, status, shortBy };
}

export interface CutInput {
  key: string;
  label: string;
  /** Average monthly spend over the last PACE_MONTHS full months, cents. */
  avgMonthly: number;
}

export interface Cut {
  key: string;
  label: string;
  avgMonthly: number;
  /** A fifth of the category's usual month, rounded to the dollar. */
  save: number;
}

/** Share of a category's usual month a suggested cut asks for. */
export const CUT_SHARE = 0.2;

/**
 * Where an off-track goal could find `need` more per month: the biggest
 * categories first, each trimmed by CUT_SHARE, until the need is covered
 * (at most three).
 */
export function suggestCuts(rows: CutInput[], need: number): Cut[] {
  if (need <= 0) return [];
  const out: Cut[] = [];
  let covered = 0;
  for (const r of [...rows].sort((a, b) => b.avgMonthly - a.avgMonthly)) {
    if (covered >= need || out.length === 3) break;
    const save = Math.round((r.avgMonthly * CUT_SHARE) / 100) * 100;
    if (save <= 0) continue;
    out.push({ ...r, save });
    covered += save;
  }
  return out;
}

/**
 * The "How it works" explainer on the Goals page (web GoalHowItWorks,
 * mobile GoalHowItWorksDialog), in order. Built from the constants above so
 * the words can't drift from the math.
 */
export const GOAL_HOW_IT_WORKS: { title: string; body: string }[] = [
  {
    title: "Your goal",
    body: "Pick a net worth to reach by Dec 31. Tally notes where you started, so the bar shows how far you've come.",
  },
  {
    title: "Your pace",
    body: `How much your net worth changed on average each month over the last ${PACE_MONTHS} full months. Recent enough to reflect how you're doing now, long enough that one big month doesn't swing it. With less history, Tally uses what it has (at least 4 weeks).`,
  },
  {
    title: "The projection",
    body: "Today's net worth plus your pace for every month left. If that lands at or above your goal, you're on track.",
  },
  {
    title: "When you're behind",
    body: `Tally shows how much more a month closes the gap and suggests trimming ${Math.round(CUT_SHARE * 100)}% from your biggest spending categories to find it. You'll get at most one heads-up a month while you're off track.`,
  },
  {
    title: "What counts",
    body: "Everything in your net worth: cash, investments and debts. Market moves and paying down debt count toward the goal, not just what you save.",
  },
];
