/**
 * How a budget row reads on the Budgets screen, shared by web and mobile so
 * the same budget looks and says the same thing in both apps: bar fill and
 * color rule, the pace tick, the right-hand label and the sub line. Pure --
 * callers format money through `formatMoney`.
 */
import { computeBurnRateProjection } from "./budgetMath";

/** Which month the row is in, relative to today. */
export type MonthPhase = "past" | "current" | "future";

export interface BudgetLineInput {
  amount: number;
  rolloverFromPrior: number;
  isFixedAmount: boolean;
  spend: number;
}

export interface MonthContext {
  phase: MonthPhase;
  /** Day of month today (current month only). */
  daysElapsed?: number;
  daysInMonth?: number;
}

export type BarTone = "category" | "warning";
export type LabelTone = "default" | "warning" | "negative" | "positive" | "muted";

export interface BudgetRowState {
  available: number;
  /** 0-1 of the bar drawn in the bar tone (the within-budget part). */
  fillPct: number;
  /** 0-1 of the bar drawn red (the overage). Fill + over = 1 when over. */
  overPct: number;
  barTone: BarTone;
  /** 0-1 position of the "where you should be by today" tick; null when it doesn't apply. */
  pacePct: number | null;
  aheadOfPace: boolean;
  /** Month-end spend at the current rate; null when not meaningful. */
  projected: number | null;
  /** Right-hand label: "$458 left", "$46 over", "Spent in full", "Paid · $2,100". */
  label: string;
  labelTone: LabelTone;
  /** Short status under the bar, e.g. "A bit ahead of pace". Null for none. */
  note: string | null;
  noteTone: LabelTone;
}

/**
 * "Ahead of pace" once spending is past the tick by 10% of the tick's
 * position, but never for less than 5 points of the bar -- so a single
 * coffee on the 1st doesn't trip it.
 */
const AHEAD_RELATIVE = 0.1;
const AHEAD_MIN = 0.05;
const NEAR_LIMIT = 0.8;

export function budgetRowState(line: BudgetLineInput, ctx: MonthContext, formatMoney: (cents: number) => string): BudgetRowState {
  const available = line.amount + line.rolloverFromPrior;
  const used = available > 0 ? line.spend / available : line.spend > 0 ? Infinity : 0;
  const over = line.spend > available;
  const fillPct = over ? (available > 0 ? available / line.spend : 0) : Math.min(1, used);
  const overPct = over ? 1 - fillPct : 0;
  // Amber is 80% up to (not including) 100%; exactly met keeps the category color.
  const barTone: BarTone = !over && used >= NEAR_LIMIT && used < 1 ? "warning" : "category";

  const current = ctx.phase === "current" && ctx.daysElapsed != null && ctx.daysInMonth != null && ctx.daysInMonth > 0;
  const pacePct = current && !line.isFixedAmount && !over ? Math.min(1, ctx.daysElapsed! / ctx.daysInMonth!) : null;
  const aheadOfPace = pacePct != null && used - pacePct > Math.max(AHEAD_MIN, pacePct * AHEAD_RELATIVE) && used < NEAR_LIMIT;
  const projectedRaw = current && !line.isFixedAmount ? computeBurnRateProjection(line.spend, ctx.daysElapsed!, ctx.daysInMonth!) : null;
  const projected = projectedRaw != null && !over && projectedRaw > available ? projectedRaw : null;

  const left = available - line.spend;
  let label: string;
  let labelTone: LabelTone = "default";
  if (line.isFixedAmount && ctx.phase !== "future") {
    label = line.spend >= line.amount ? `Paid · ${formatMoney(line.spend)}` : line.spend > 0 ? `${formatMoney(line.spend)} of ${formatMoney(available)} paid` : "Not paid yet";
    labelTone = line.spend > available ? "negative" : "default";
  } else if (ctx.phase === "future") {
    label = `${formatMoney(available)} budget`;
    labelTone = "muted";
  } else if (over) {
    label = `${formatMoney(-left)} over`;
    labelTone = "negative";
  } else if (left === 0) {
    label = "Spent in full";
  } else if (ctx.phase === "past") {
    label = `${formatMoney(left)} under`;
    labelTone = "positive";
  } else {
    label = `${formatMoney(left)} left`;
    labelTone = barTone === "warning" ? "warning" : "default";
  }

  let note: string | null = null;
  let noteTone: LabelTone = "muted";
  if (projected != null) {
    note = `On pace for ${formatMoney(projected)}`;
    noteTone = "warning";
  } else if (aheadOfPace) {
    note = "A bit ahead of pace";
    noteTone = "warning";
  }

  return { available, fillPct, overPct, barTone, pacePct, aheadOfPace, projected, label, labelTone, note, noteTone };
}

export interface MonthSummary {
  budgeted: number;
  spent: number;
  left: number;
  /** Per-day allowance for the rest of the month (current month, positive left only). */
  perDay: number | null;
  daysLeft: number | null;
  overCount: number;
}

/** "$511 left · about $20 a day for 26 days" -- totals over budgeted categories. */
export function monthSummary(lines: BudgetLineInput[], ctx: MonthContext): MonthSummary {
  const budgeted = lines.reduce((s, l) => s + l.amount + l.rolloverFromPrior, 0);
  const spent = lines.reduce((s, l) => s + l.spend, 0);
  const left = budgeted - spent;
  const daysLeft = ctx.phase === "current" && ctx.daysElapsed != null && ctx.daysInMonth != null ? Math.max(0, ctx.daysInMonth - ctx.daysElapsed + 1) : null;
  const perDay = daysLeft != null && daysLeft > 0 && left > 0 ? Math.floor(left / daysLeft) : null;
  return { budgeted, spent, left, perDay, daysLeft, overCount: lines.filter((l) => l.spend > l.amount + l.rolloverFromPrior).length };
}

export interface GroupableLine extends BudgetLineInput {
  parentName: string | null;
  categoryName: string;
}

export interface BudgetGroup<T extends GroupableLine> {
  name: string;
  lines: T[];
  budgeted: number;
  spent: number;
}

/**
 * Rows grouped by parent category (a top-level budget is its own group's
 * name), groups ordered by budget size so the big fixed costs come first.
 */
export function groupBudgets<T extends GroupableLine>(lines: T[]): BudgetGroup<T>[] {
  const groups = new Map<string, T[]>();
  for (const l of lines) {
    const key = l.parentName ?? l.categoryName;
    groups.set(key, [...(groups.get(key) ?? []), l]);
  }
  return [...groups.entries()]
    .map(([name, ls]) => ({
      name,
      lines: [...ls].sort((a, b) => b.amount + b.rolloverFromPrior - (a.amount + a.rolloverFromPrior)),
      budgeted: ls.reduce((s, l) => s + l.amount + l.rolloverFromPrior, 0),
      spent: ls.reduce((s, l) => s + l.spend, 0),
    }))
    .sort((a, b) => b.budgeted - a.budgeted);
}
