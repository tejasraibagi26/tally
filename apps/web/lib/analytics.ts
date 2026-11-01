import { and, asc, eq, gte, lt, not } from "drizzle-orm";
import { db, schema } from "@/db";
import { userCategories } from "@/lib/userCategories";
import { monthRange, shiftMonth } from "@tally/core/budgetMath";
import { hasSplits } from "@/lib/budgets";

export interface CashFlowMonth {
  month: string; // YYYY-MM-01
  income: number;
  spend: number;
  cashFlow: number;
}

/** §9 "Month spend"/"Income" for a single month — the single-month case of cashFlowTrend's per-bucket logic, without fetching the other 12 months. */
export async function monthTotals(userId: string, month: string): Promise<{ income: number; spend: number }> {
  const { start, end } = monthRange(month);
  const rows = await db
    .select({ amount: schema.transactions.amount, categoryKind: schema.categories.kind })
    .from(schema.transactions)
    .leftJoin(schema.categories, eq(schema.transactions.categoryId, schema.categories.id))
    .where(
      and(
        eq(schema.transactions.userId, userId),
        eq(schema.transactions.isTransfer, false),
        eq(schema.transactions.excludedFromBudget, false),
        gte(schema.transactions.postedDate, start),
        lt(schema.transactions.postedDate, end),
      ),
    );

  let income = 0;
  let spend = 0;
  for (const r of rows) {
    if (r.categoryKind === "income") income += r.amount;
    else if (r.categoryKind === "expense") spend += Math.abs(r.amount);
  }
  return { income, spend };
}

/** Spend per day of `month`, in cents by YYYY-MM-DD -- monthTotals' definition of spend (expense categories, no transfers or excluded rows). Days with no spend are absent. */
export async function dailySpend(userId: string, month: string): Promise<Record<string, number>> {
  const { start, end } = monthRange(month);
  const rows = await db
    .select({ postedDate: schema.transactions.postedDate, amount: schema.transactions.amount })
    .from(schema.transactions)
    .innerJoin(schema.categories, eq(schema.transactions.categoryId, schema.categories.id))
    .where(
      and(
        eq(schema.transactions.userId, userId),
        eq(schema.transactions.isTransfer, false),
        eq(schema.transactions.excludedFromBudget, false),
        eq(schema.categories.kind, "expense"),
        gte(schema.transactions.postedDate, start),
        lt(schema.transactions.postedDate, end),
      ),
    );
  const byDay: Record<string, number> = {};
  for (const r of rows) byDay[r.postedDate] = (byDay[r.postedDate] ?? 0) + Math.abs(r.amount);
  return byDay;
}

/** §9 "Cash flow": income − spend, per month, N-month trailing series (default 13, matching the spec's own example). */
export async function cashFlowTrend(userId: string, months = 13): Promise<CashFlowMonth[]> {
  const monthStarts: string[] = [];
  let cursor = new Date().toISOString().slice(0, 8) + "01";
  for (let i = 0; i < months; i++) {
    monthStarts.unshift(cursor);
    cursor = shiftMonth(cursor, -1);
  }
  const earliestStart = monthStarts[0]!;

  const rows = await db
    .select({
      postedDate: schema.transactions.postedDate,
      amount: schema.transactions.amount,
      categoryKind: schema.categories.kind,
    })
    .from(schema.transactions)
    .leftJoin(schema.categories, eq(schema.transactions.categoryId, schema.categories.id))
    .where(
      and(
        eq(schema.transactions.userId, userId),
        eq(schema.transactions.isTransfer, false),
        eq(schema.transactions.excludedFromBudget, false),
        gte(schema.transactions.postedDate, earliestStart),
      ),
    );

  const byMonth = new Map<string, { income: number; spend: number }>();
  for (const m of monthStarts) byMonth.set(m, { income: 0, spend: 0 });

  for (const r of rows) {
    const monthKey = r.postedDate.slice(0, 7) + "-01";
    const bucket = byMonth.get(monthKey);
    if (!bucket) continue;
    if (r.categoryKind === "income") bucket.income += r.amount;
    else if (r.categoryKind === "expense") bucket.spend += Math.abs(r.amount);
  }

  return monthStarts.map((month) => {
    const b = byMonth.get(month)!;
    return { month, income: b.income, spend: b.spend, cashFlow: b.income - b.spend };
  });
}

/**
 * cashFlowTrend's window, but for the FIRE calculator's defaults: a month
 * before the user's earliest transaction (they hadn't connected an account
 * yet — a recent mover with only 2 months on file, say) reads as genuinely
 * $0 income/spend there, which would badly understate a "trailing 12mo"
 * estimate for anyone without a full year of history. A month that HAS
 * history, even a genuine $0-spend one, is left alone — only months before
 * any data existed get substituted, with the highest real income/spend
 * month on file standing in as a conservative estimate rather than a silent
 * $0. Recomputed fresh on every read (nothing's stored), so it keeps
 * updating toward the real 12-month total as more actual months accumulate
 * and fewer need substituting.
 */
export async function trailingAnnualCashFlowEstimate(userId: string, months = 12): Promise<{ income: number; expenses: number; coveredMonths: number }> {
  const trend = await cashFlowTrend(userId, months);

  const [earliest] = await db
    .select({ postedDate: schema.transactions.postedDate })
    .from(schema.transactions)
    .where(eq(schema.transactions.userId, userId))
    .orderBy(asc(schema.transactions.postedDate))
    .limit(1);
  const earliestMonth = earliest ? earliest.postedDate.slice(0, 7) + "-01" : null;

  const covered = earliestMonth != null ? trend.filter((m) => m.month >= earliestMonth) : [];
  const highestIncome = covered.reduce((max, m) => Math.max(max, m.income), 0);
  const highestSpend = covered.reduce((max, m) => Math.max(max, m.spend), 0);

  let income = 0;
  let expenses = 0;
  for (const m of trend) {
    const isCovered = earliestMonth != null && m.month >= earliestMonth;
    income += isCovered ? m.income : highestIncome;
    expenses += isCovered ? m.spend : highestSpend;
  }
  // How many of the months are real data (the rest are filled in above) --
  // the FIRE planner says when its spending figure is an estimate.
  return { income, expenses, coveredMonths: covered.length };
}

export interface BreakdownRow {
  key: string; // categoryId or normalized merchant name
  label: string;
  colorSlot: number;
  total: number; // cents, positive
}

/**
 * §9 "Spending by category and merchant" — ranked, expense-kind, non-transfer, non-excluded, for one month.
 * A split transaction counts through its lines' categories, same as spendByCategory.
 */
export async function categoryBreakdown(userId: string, month: string): Promise<BreakdownRow[]> {
  const uc = userCategories(userId);
  const { start, end } = monthRange(month);
  const inMonth = and(
    eq(schema.transactions.userId, userId),
    eq(schema.transactions.isTransfer, false),
    eq(schema.transactions.excludedFromBudget, false),
    eq(uc.kind, "expense"),
    gte(schema.transactions.postedDate, start),
    lt(schema.transactions.postedDate, end),
  );
  const [whole, split] = await Promise.all([
    db
      .select({
        categoryId: schema.transactions.categoryId,
        categoryName: uc.name,
        colorSlot: uc.colorSlot,
        amount: schema.transactions.amount,
      })
      .from(schema.transactions)
      .innerJoin(uc, eq(schema.transactions.categoryId, uc.id))
      .where(and(inMonth, not(hasSplits))),
    db
      .select({
        categoryId: schema.transactionSplits.categoryId,
        categoryName: uc.name,
        colorSlot: uc.colorSlot,
        amount: schema.transactionSplits.amount,
      })
      .from(schema.transactionSplits)
      .innerJoin(schema.transactions, eq(schema.transactionSplits.transactionId, schema.transactions.id))
      .innerJoin(uc, eq(schema.transactionSplits.categoryId, uc.id))
      .where(inMonth),
  ]);
  const rows = [...whole, ...split];

  const totals = new Map<string, BreakdownRow>();
  for (const r of rows) {
    if (!r.categoryId) continue;
    const existing = totals.get(r.categoryId);
    if (existing) existing.total += Math.abs(r.amount);
    else totals.set(r.categoryId, { key: r.categoryId, label: r.categoryName, colorSlot: r.colorSlot, total: Math.abs(r.amount) });
  }
  return [...totals.values()].sort((a, b) => b.total - a.total);
}

export async function merchantBreakdown(userId: string, month: string): Promise<BreakdownRow[]> {
  const uc = userCategories(userId);
  const { start, end } = monthRange(month);
  const rows = await db
    .select({
      merchantName: schema.transactions.merchantName,
      name: schema.transactions.name,
      amount: schema.transactions.amount,
      colorSlot: uc.colorSlot,
    })
    .from(schema.transactions)
    .innerJoin(uc, eq(schema.transactions.categoryId, uc.id))
    .where(
      and(
        eq(schema.transactions.userId, userId),
        eq(schema.transactions.isTransfer, false),
        eq(schema.transactions.excludedFromBudget, false),
        eq(uc.kind, "expense"),
        gte(schema.transactions.postedDate, start),
        lt(schema.transactions.postedDate, end),
      ),
    );

  const totals = new Map<string, BreakdownRow>();
  for (const r of rows) {
    const label = r.merchantName ?? r.name;
    const existing = totals.get(label);
    if (existing) existing.total += Math.abs(r.amount);
    else totals.set(label, { key: label, label, colorSlot: r.colorSlot, total: Math.abs(r.amount) });
  }
  return [...totals.values()].sort((a, b) => b.total - a.total);
}
