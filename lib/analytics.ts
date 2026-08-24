import { and, eq, gte, lt, lte } from "drizzle-orm";
import { db, schema } from "@/db";
import { monthRange, shiftMonth } from "@/lib/budgetMath";

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

export interface BreakdownRow {
  key: string; // categoryId or normalized merchant name
  label: string;
  colorSlot: number;
  total: number; // cents, positive
}

/** §9 "Spending by category and merchant" — ranked, expense-kind, non-transfer, non-excluded, for one month. */
export async function categoryBreakdown(userId: string, month: string): Promise<BreakdownRow[]> {
  const { start, end } = monthRange(month);
  const rows = await db
    .select({
      categoryId: schema.transactions.categoryId,
      categoryName: schema.categories.name,
      colorSlot: schema.categories.colorSlot,
      amount: schema.transactions.amount,
    })
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
  const { start, end } = monthRange(month);
  const rows = await db
    .select({
      merchantName: schema.transactions.merchantName,
      name: schema.transactions.name,
      amount: schema.transactions.amount,
      colorSlot: schema.categories.colorSlot,
    })
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

  const totals = new Map<string, BreakdownRow>();
  for (const r of rows) {
    const label = r.merchantName ?? r.name;
    const existing = totals.get(label);
    if (existing) existing.total += Math.abs(r.amount);
    else totals.set(label, { key: label, label, colorSlot: r.colorSlot, total: Math.abs(r.amount) });
  }
  return [...totals.values()].sort((a, b) => b.total - a.total);
}

export interface UpcomingBill {
  type: "subscription" | "card";
  label: string;
  amount: number; // cents
  dueDate: string;
  accountId: string | null;
}

/**
 * §9 "Upcoming bills": recurring streams predicted (or manually overridden,
 * schema.ts's recurringStreams.manualNextDueDate) within 30 days, plus credit
 * card due dates within 30 days. A manual override is honored even over a
 * stream the gap-based detector marked at_risk/cancelled — a bill paid in
 * occasional lump sums (rent prepaid several months at once) can look
 * "cancelled" to that algorithm despite the user knowing exactly when it's
 * next due.
 */
export async function upcomingBills(userId: string, withinDays = 30): Promise<UpcomingBill[]> {
  const today = new Date().toISOString().slice(0, 10);
  const cutoff = new Date(Date.now() + withinDays * 86_400_000).toISOString().slice(0, 10);

  const streamRows = await db
    .select({
      description: schema.recurringStreams.description,
      merchantKey: schema.recurringStreams.merchantKey,
      averageAmount: schema.recurringStreams.averageAmount,
      predictedNextDate: schema.recurringStreams.predictedNextDate,
      manualNextDueDate: schema.recurringStreams.manualNextDueDate,
      status: schema.recurringStreams.status,
      accountId: schema.recurringStreams.accountId,
    })
    .from(schema.recurringStreams)
    .where(eq(schema.recurringStreams.userId, userId));

  const streams = streamRows
    .map((s) => ({ ...s, dueDate: s.manualNextDueDate ?? s.predictedNextDate }))
    .filter((s) => s.dueDate != null && s.dueDate >= today && s.dueDate <= cutoff && (s.manualNextDueDate != null || s.status === "active"));

  const cards = await db
    .select({
      name: schema.accounts.name,
      accountId: schema.accounts.id,
      amount: schema.liabilitiesCredit.minimumPaymentAmount,
      dueDate: schema.liabilitiesCredit.nextPaymentDueDate,
    })
    .from(schema.liabilitiesCredit)
    .innerJoin(schema.accounts, eq(schema.liabilitiesCredit.accountId, schema.accounts.id))
    .where(and(eq(schema.accounts.userId, userId), gte(schema.liabilitiesCredit.nextPaymentDueDate, today), lte(schema.liabilitiesCredit.nextPaymentDueDate, cutoff)));

  const bills: UpcomingBill[] = [
    ...streams.map((s) => ({
      type: "subscription" as const,
      label: s.description ?? s.merchantKey,
      amount: Math.abs(s.averageAmount),
      dueDate: s.dueDate!,
      accountId: s.accountId,
    })),
    ...cards.map((c) => ({
      type: "card" as const,
      label: `${c.name} payment`,
      amount: c.amount ?? 0,
      dueDate: c.dueDate!,
      accountId: c.accountId,
    })),
  ];

  return bills.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
}
