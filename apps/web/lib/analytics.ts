import { and, asc, eq, gte, isNull, lt, not } from "drizzle-orm";
import { db, schema } from "@/db";
import { creditCardsForUser, viewForCard } from "@/lib/liabilities";
import { monthRange, shiftMonth } from "@tally/core/budgetMath";
import { hasSplits } from "@/lib/budgets";
import { accountDisplayName } from "@tally/core/accountName";
import { UPCOMING_GRACE_DAYS, daysBefore, overdueDays, qualifiesAsUpcoming } from "@tally/core/overviewView";
import { todayFor } from "@/lib/userTimezone";

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
  const { start, end } = monthRange(month);
  const inMonth = and(
    eq(schema.transactions.userId, userId),
    eq(schema.transactions.isTransfer, false),
    eq(schema.transactions.excludedFromBudget, false),
    eq(schema.categories.kind, "expense"),
    gte(schema.transactions.postedDate, start),
    lt(schema.transactions.postedDate, end),
  );
  const [whole, split] = await Promise.all([
    db
      .select({
        categoryId: schema.transactions.categoryId,
        categoryName: schema.categories.name,
        colorSlot: schema.categories.colorSlot,
        amount: schema.transactions.amount,
      })
      .from(schema.transactions)
      .innerJoin(schema.categories, eq(schema.transactions.categoryId, schema.categories.id))
      .where(and(inMonth, not(hasSplits))),
    db
      .select({
        categoryId: schema.transactionSplits.categoryId,
        categoryName: schema.categories.name,
        colorSlot: schema.categories.colorSlot,
        amount: schema.transactionSplits.amount,
      })
      .from(schema.transactionSplits)
      .innerJoin(schema.transactions, eq(schema.transactionSplits.transactionId, schema.transactions.id))
      .innerJoin(schema.categories, eq(schema.transactionSplits.categoryId, schema.categories.id))
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
  /** Cents. Null for a card payment whose bank reported no minimum: unknown, never zero. */
  amount: number | null;
  /** A card's last statement balance in cents, when the bank sent one; null otherwise. */
  statementBalance: number | null;
  /** A card: payments toward that statement so far (transactions or the bank's record); absent/null when none. */
  paidSoFar?: number | null;
  /** Past its due date, or a card the bank flags as past due. */
  overdue: boolean;
  /** Whole days past the due date; 0 when not past it (a bank-flagged card can be overdue with 0). */
  overdueDays: number;
  dueDate: string;
  accountId: string | null;
  /** The recurring stream behind a "subscription" bill; null for a card payment. */
  streamId: string | null;
  /** True when Tally guessed this from past charges, so the user can tell it "this won't recur". False for a card payment (the bank's own due date) and for a bill the user added themselves. */
  canDismiss: boolean;
}

/**
 * §9 "Upcoming bills": recurring streams predicted (or manually overridden,
 * schema.ts's recurringStreams.manualNextDueDate) within 30 days, plus credit
 * card due dates within 30 days. A manual override is honored even over a
 * stream the gap-based detector marked at_risk/cancelled — a bill paid in
 * occasional lump sums (rent prepaid several months at once) can look
 * "cancelled" to that algorithm despite the user knowing exactly when it's
 * next due.
 *
 * A bill stays listed for UPCOMING_GRACE_DAYS after its due date, marked
 * overdue; a card the bank flags as past due is listed whatever its date. A
 * card with no reported minimum has a null amount rather than a misleading 0.
 *
 * Only money going out is listed (a detected paycheck, bonus or refund isn't a
 * bill, and none of it is guaranteed), a stream the user dismissed stays gone,
 * and a guessed stream must clear MIN_UPCOMING_CONFIDENCE
 * (qualifiesAsUpcoming in @tally/core/overviewView). Dates are the
 * user's own today, not the server's UTC day.
 */
export async function upcomingBills(userId: string, withinDays = 30): Promise<UpcomingBill[]> {
  const today = await todayFor(userId);
  const from = daysBefore(today, UPCOMING_GRACE_DAYS);
  const cutoff = new Date(new Date(`${today}T00:00:00Z`).getTime() + withinDays * 86_400_000).toISOString().slice(0, 10);

  const streamRows = await db
    .select({
      id: schema.recurringStreams.id,
      description: schema.recurringStreams.description,
      merchantKey: schema.recurringStreams.merchantKey,
      averageAmount: schema.recurringStreams.averageAmount,
      predictedNextDate: schema.recurringStreams.predictedNextDate,
      manualNextDueDate: schema.recurringStreams.manualNextDueDate,
      status: schema.recurringStreams.status,
      accountId: schema.recurringStreams.accountId,
      isManual: schema.recurringStreams.isManual,
      confidence: schema.recurringStreams.confidence,
    })
    .from(schema.recurringStreams)
    .where(and(eq(schema.recurringStreams.userId, userId), isNull(schema.recurringStreams.dismissedAt)));

  const streams = streamRows
    .map((s) => ({ ...s, dueDate: s.manualNextDueDate ?? s.predictedNextDate }))
    .filter((s) => qualifiesAsUpcoming(s, from, cutoff));

  // Card payments go through @tally/core/cardView: payments found in the
  // card's transactions (or the bank's own record) since the statement closed
  // count, so a paid statement drops off instead of lingering at the bank's
  // $0.00 minimum, and a partly paid one shows what's left.
  const cards = (await creditCardsForUser(userId))
    .map((c) => ({ c, view: viewForCard(c, today), dueDate: c.liability?.nextPaymentDueDate ?? null }))
    .filter(({ view, dueDate }) => view.state !== "paid" && (view.state === "overdue" || (dueDate != null && dueDate >= today && dueDate <= cutoff)));

  const bills: UpcomingBill[] = [
    ...streams.map((s) => ({
      type: "subscription" as const,
      label: s.description ?? s.merchantKey,
      amount: Math.abs(s.averageAmount),
      statementBalance: null,
      overdue: s.dueDate! < today,
      overdueDays: overdueDays(s.dueDate!, today),
      dueDate: s.dueDate!,
      accountId: s.accountId,
      streamId: s.id,
      canDismiss: !s.isManual,
    })),
    ...cards.map(({ c, view, dueDate }) => ({
      type: "card" as const,
      label: `${accountDisplayName(c.name, c.nickname)} payment`,
      amount: view.amountDue,
      statementBalance: c.liability?.lastStatementBalance ?? null,
      paidSoFar: view.paid > 0 ? view.paid : null,
      // Overdue when the bank says so, or the date passed with the minimum unpaid.
      overdue: view.state === "overdue",
      overdueDays: view.overdueDays,
      dueDate: dueDate ?? today,
      accountId: c.accountId,
      streamId: null,
      canDismiss: false,
    })),
  ];

  // Overdue first, then by date.
  return bills.sort((a, b) => Number(b.overdue) - Number(a.overdue) || a.dueDate.localeCompare(b.dueDate));
}
