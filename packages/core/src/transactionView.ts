/**
 * How a transaction row reads in both apps: at most one status mark, the
 * amount's style, whether it counts toward spend, who set its category,
 * and grouping rows under day headers. Pure -- callers pass already-loaded
 * fields and format money themselves.
 */

export interface TransactionRowInput {
  /** Cents; positive = money in, negative = money out. */
  amount: number;
  isPending: boolean;
  isTransfer: boolean;
  excludedFromBudget: boolean;
  isManual: boolean;
  /** "shortcut" for Apple Pay shortcut imports. */
  source: string | null;
  name: string;
  merchantName: string | null;
  categoryId: string | null;
  categoryKind: string | null;
  categorySource: string;
  splitCount: number;
  recurringStreamId: string | null;
  reviewed: boolean;
  currency: string;
}

export type RowMarkKind = "pending" | "refund" | "transfer" | "split" | "spread" | "excluded" | "foreign" | "manual" | "applePay";

export interface RowMark {
  kind: RowMarkKind;
  text: string;
}

export interface TransactionRowView {
  /** The single mark shown beside the name (null for a plain row). */
  mark: RowMark | null;
  amountTone: "positive" | "default" | "muted";
  /** Amount drawn struck through (excluded from budgets). */
  struck: boolean;
  countsInSpend: boolean;
  needsReview: boolean;
  uncategorized: boolean;
  recurring: boolean;
  /** "by rule" / "by you" / "by Tally"; null when uncategorized. */
  sourceLabel: string | null;
}

const SPREAD_RE = /\((\d+)\/(\d+)\)$/;

/**
 * Mark precedence, most important first: pending, transfer, excluded,
 * split, spread, refund, foreign, Apple Pay / manual. One mark per row --
 * the old list could stack three uppercase pills.
 */
export function describeTransactionRow(t: TransactionRowInput, defaultCurrency: string): TransactionRowView {
  const display = t.merchantName ?? t.name;
  const spread = display.match(SPREAD_RE) ?? t.name.match(SPREAD_RE);
  const refund = t.amount > 0 && t.categoryKind === "expense" && !t.isTransfer;

  let mark: RowMark | null = null;
  if (t.isPending) mark = { kind: "pending", text: "pending" };
  else if (t.isTransfer) mark = { kind: "transfer", text: "Transfer" };
  else if (t.excludedFromBudget) mark = { kind: "excluded", text: "Excluded" };
  else if (t.splitCount > 1) mark = { kind: "split", text: `Split · ${t.splitCount}` };
  else if (spread) mark = { kind: "spread", text: `Spread · ${spread[1]} of ${spread[2]}` };
  else if (refund) mark = { kind: "refund", text: "Refund" };
  else if (t.currency && t.currency !== defaultCurrency) mark = { kind: "foreign", text: t.currency };
  else if (t.isManual && t.source === "shortcut") mark = { kind: "applePay", text: "Apple Pay" };
  else if (t.isManual) mark = { kind: "manual", text: "Added by you" };

  const countsInSpend = !t.isTransfer && !t.excludedFromBudget;
  return {
    mark,
    amountTone: t.isPending || t.isTransfer || t.excludedFromBudget ? "muted" : t.amount > 0 ? "positive" : "default",
    struck: t.excludedFromBudget && !t.isTransfer,
    countsInSpend,
    needsReview: !t.reviewed,
    uncategorized: !t.categoryId && !t.isTransfer,
    recurring: !!t.recurringStreamId,
    sourceLabel: !t.categoryId ? null : t.categorySource === "manual" ? "by you" : t.categorySource === "rule" ? "by rule" : "by Tally",
  };
}

export interface DayGroup<T> {
  /** YYYY-MM-DD */
  date: string;
  /** "Today · Sun, Oct 5", "Yesterday · Sat, Oct 4", "Fri, Oct 3", "Mon, Dec 29, 2025". */
  label: string;
  /** Net of rows that count in spend (transfers and excluded rows left out). */
  net: number;
  rows: T[];
}

function dayLabel(date: string, today: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  const base = d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC", ...(date.slice(0, 4) !== today.slice(0, 4) ? { year: "numeric" } : {}) });
  const t = new Date(`${today}T00:00:00Z`);
  const diff = Math.round((t.getTime() - d.getTime()) / 86_400_000);
  if (diff === 0) return `Today · ${base}`;
  if (diff === 1) return `Yesterday · ${base}`;
  return base;
}

/** Rows (already sorted newest first) grouped under day headers with each day's net. */
export function groupByDay<T extends { postedDate: string; amount: number; isTransfer: boolean; excludedFromBudget: boolean }>(rows: T[], today: string): DayGroup<T>[] {
  const groups: DayGroup<T>[] = [];
  for (const r of rows) {
    let g = groups[groups.length - 1];
    if (!g || g.date !== r.postedDate) {
      g = { date: r.postedDate, label: dayLabel(r.postedDate, today), net: 0, rows: [] };
      groups.push(g);
    }
    g.rows.push(r);
    if (!r.isTransfer && !r.excludedFromBudget) g.net += r.amount;
  }
  return groups;
}

export interface CategorySuggestion {
  categoryId: string;
  /** Why it's suggested: what you picked before for this merchant, or the bank's guess. */
  reason: "history" | "current";
}

/**
 * Up to three categories to offer in the review queue: the row's current
 * category first (Tally's guess), then this merchant's most frequent past
 * choices. `history` is category ids from earlier reviewed rows of the same
 * merchant, newest first.
 */
export function suggestCategories(currentCategoryId: string | null, history: string[], limit = 3): CategorySuggestion[] {
  const out: CategorySuggestion[] = [];
  if (currentCategoryId) out.push({ categoryId: currentCategoryId, reason: "current" });
  const counts = new Map<string, number>();
  for (const id of history) counts.set(id, (counts.get(id) ?? 0) + 1);
  const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id);
  for (const id of ranked) {
    if (out.length >= limit) break;
    if (!out.some((s) => s.categoryId === id)) out.push({ categoryId: id, reason: "history" });
  }
  return out;
}

export interface TransactionDetailInput {
  /** Cents; positive = money in, negative = money out. */
  amount: number;
  isPending: boolean;
  isTransfer: boolean;
  isManual: boolean;
  categoryId: string | null;
  categorySource: string | null;
  recurringStreamId: string | null;
  /** Term of the stream this charge belongs to; null when it has none. */
  amortizeMonths: number | null;
}

export interface TransactionDetailView {
  amountTone: "positive" | "default" | "muted";
  /** "Set by you" / "Set by a rule" / "Tally's guess"; null when uncategorized or a transfer. */
  sourceText: string | null;
  /** Transfers have no category, split or spread. */
  canCategorize: boolean;
  canSplit: boolean;
  /** Spreading a prepaid plan applies to money out only. */
  canSpread: boolean;
  /** Months this charge is spread across; null when it isn't. */
  spreadMonths: number | null;
  /** One month's share of a spread charge (manual installment rows); they're edited from the real charge. */
  isInstallment: boolean;
  /** The server only deletes rows you added, and never a spread's installments. */
  canDelete: boolean;
  notice: { kind: "pending" | "transfer"; title: string; body: string } | null;
}

/**
 * What the transaction edit screen (web side panel, mobile sheet) offers
 * for one transaction -- which blocks apply and how the header reads.
 */
export function describeTransactionDetail(t: TransactionDetailInput): TransactionDetailView {
  const isInstallment = t.isManual && !!t.recurringStreamId;
  const notice = t.isTransfer
    ? { kind: "transfer" as const, title: "Transfer · not counted in spend", body: "No category, split or spread. Notes and tags still work." }
    : t.isPending
      ? { kind: "pending" as const, title: "Pending", body: "The amount can change when it posts. Your category and note carry over." }
      : null;
  return {
    amountTone: t.isPending || t.isTransfer ? "muted" : t.amount > 0 ? "positive" : "default",
    sourceText: t.isTransfer || !t.categoryId ? null : t.categorySource === "manual" ? "Set by you" : t.categorySource === "rule" ? "Set by a rule" : "Tally's guess",
    canCategorize: !t.isTransfer,
    canSplit: !t.isTransfer && !isInstallment,
    canSpread: !t.isTransfer && !isInstallment && t.amount < 0,
    spreadMonths: t.recurringStreamId && !t.isManual ? (t.amortizeMonths ?? 12) : null,
    isInstallment,
    canDelete: t.isManual && !t.recurringStreamId,
    notice,
  };
}

export interface SplitBalance {
  /** Cents assigned to split lines (each line's amount is positive). */
  allocated: number;
  /** Cents of the transaction left to assign; negative when lines exceed it. */
  remaining: number;
  /** Every line has a positive amount and together they match the total exactly. */
  balanced: boolean;
}

/** How split lines (positive cents) add up against a transaction's amount. */
export function splitBalance(amount: number, lines: number[]): SplitBalance {
  const total = Math.abs(amount);
  const allocated = lines.reduce((s, n) => s + n, 0);
  const remaining = total - allocated;
  return { allocated, remaining, balanced: lines.length >= 2 && remaining === 0 && lines.every((n) => n > 0) };
}

/** Splits `amount` into `parts` positive cent amounts that add up exactly (the first lines take the leftover cents). */
export function splitEvenly(amount: number, parts: number): number[] {
  const total = Math.abs(amount);
  if (parts <= 0) return [];
  const base = Math.floor(total / parts);
  const extra = total - base * parts;
  return Array.from({ length: parts }, (_, i) => base + (i < extra ? 1 : 0));
}

/** One month's share of a charge spread over `months` (cents, positive). */
export function spreadMonthly(amount: number, months: number): number {
  return Math.round(Math.abs(amount) / months);
}
