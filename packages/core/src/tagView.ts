/**
 * Tags as rollups (trips, events, projects): one tag's transactions summed
 * across categories, for the Tags pages on web and mobile. Pure: callers
 * pass the tagged rows.
 *
 * Spend is net: a refund tagged the same way brings the trip's cost down.
 * Transfers never count.
 */

export interface TaggedRow {
  id: string;
  date: string; // YYYY-MM-DD
  amount: number; // cents, signed (spend negative)
  isTransfer: boolean;
  categoryId: string | null;
  categoryName: string | null;
  colorSlot: number | null;
  categoryKind: string | null; // expense | income | transfer
}

export interface TagSummary {
  tag: string;
  /** Net spend (positive = money out). */
  spend: number;
  /** Income-kind money in carrying the tag (a reimbursement, say). */
  income: number;
  count: number;
  firstDate: string | null;
  lastDate: string | null;
  /** Calendar days from first to last, inclusive. */
  days: number;
  /** spend ÷ days; null for one day or none. */
  perDay: number | null;
  byCategory: { key: string; label: string; colorSlot: number; total: number; share: number }[];
  /** Spend per day with any, ascending. */
  byDay: { date: string; total: number }[];
}

const DAY_MS = 86_400_000;

export function summarizeTag(tag: string, rows: TaggedRow[]): TagSummary {
  const counted = rows.filter((r) => !r.isTransfer);
  const spending = counted.filter((r) => r.categoryKind !== "income");
  const spend = -spending.reduce((s, r) => s + r.amount, 0);
  const income = counted.filter((r) => r.categoryKind === "income").reduce((s, r) => s + r.amount, 0);

  const dates = counted.map((r) => r.date).sort();
  const firstDate = dates[0] ?? null;
  const lastDate = dates.at(-1) ?? null;
  const days = firstDate && lastDate ? Math.round((Date.parse(`${lastDate}T00:00:00Z`) - Date.parse(`${firstDate}T00:00:00Z`)) / DAY_MS) + 1 : 0;

  const cats = new Map<string, { key: string; label: string; colorSlot: number; total: number }>();
  const perDay = new Map<string, number>();
  for (const r of spending) {
    const key = r.categoryId ?? "uncategorized";
    const c = cats.get(key) ?? { key, label: r.categoryName ?? "Uncategorized", colorSlot: r.colorSlot ?? 0, total: 0 };
    c.total -= r.amount;
    cats.set(key, c);
    perDay.set(r.date, (perDay.get(r.date) ?? 0) - r.amount);
  }
  const positive = [...cats.values()].filter((c) => c.total > 0);
  const catTotal = positive.reduce((s, c) => s + c.total, 0) || 1;

  return {
    tag,
    spend,
    income,
    count: counted.length,
    firstDate,
    lastDate,
    days,
    perDay: days > 1 ? Math.round(spend / days) : null,
    byCategory: positive.sort((a, b) => b.total - a.total).map((c) => ({ ...c, share: c.total / catTotal })),
    byDay: [...perDay.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, total]) => ({ date, total })),
  };
}

/** A tag as typed: trimmed, inner spaces collapsed, at most 40 characters (the API's limit). */
export function normalizeTag(input: string): string {
  return input.trim().replace(/\s+/g, " ").slice(0, 40);
}
