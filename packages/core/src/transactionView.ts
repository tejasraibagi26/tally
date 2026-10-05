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
