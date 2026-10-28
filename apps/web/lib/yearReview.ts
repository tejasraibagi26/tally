import { and, asc, desc, eq, gte, isNull, lt, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { monthTotals, categoryBreakdown } from "@/lib/analytics";
import { computeAndStoreNetWorthSnapshot } from "@/lib/networth";
import { todayFor } from "@/lib/userTimezone";
import { isActiveExpenseStream, subscriptionsMonthlyTotal } from "@tally/core/subscriptionMath";
import { buildYearReview, type YearRankInput, type YearReview } from "@tally/core/yearReview";

/**
 * One calendar year's money for the Year in review page (web) and GET
 * /api/year-in-review (mobile): the same monthTotals / categoryBreakdown
 * definitions as Overview and the monthly recap, summed over the year's
 * started months, shaped by @tally/core/yearReview.
 */
export async function yearReviewFor(userId: string, year: number): Promise<YearReview> {
  const today = await todayFor(userId);
  const start = `${year}-01-01`;
  const end = `${year + 1}-01-01`;
  const months = Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, "0")}-01`).filter((m) => m <= today);

  const [totals, breakdowns, merchantRows, [counted], streams] = await Promise.all([
    Promise.all(months.map(async (month) => ({ month, ...(await monthTotals(userId, month)) }))),
    Promise.all(months.map((month) => categoryBreakdown(userId, month))),
    // The same spend definition as merchantBreakdown, over the whole year, with how often.
    db
      .select({
        label: sql<string>`coalesce(${schema.transactions.merchantName}, ${schema.transactions.name})`,
        total: sql<number>`sum(abs(${schema.transactions.amount}))::bigint`,
        count: sql<number>`count(*)::int`,
        colorSlot: sql<number>`min(${schema.categories.colorSlot})::int`,
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
      )
      .groupBy(sql`coalesce(${schema.transactions.merchantName}, ${schema.transactions.name})`)
      .orderBy(desc(sql`sum(abs(${schema.transactions.amount}))`))
      .limit(20),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.transactions)
      .where(and(eq(schema.transactions.userId, userId), eq(schema.transactions.isTransfer, false), gte(schema.transactions.postedDate, start), lt(schema.transactions.postedDate, end))),
    db
      .select({
        averageAmount: schema.recurringStreams.averageAmount,
        frequency: schema.recurringStreams.frequency,
        status: schema.recurringStreams.status,
        manualNextDueDate: schema.recurringStreams.manualNextDueDate,
        isManual: schema.recurringStreams.isManual,
        amortizeMonthly: schema.recurringStreams.amortizeMonthly,
        amortizeMonths: schema.recurringStreams.amortizeMonths,
      })
      .from(schema.recurringStreams)
      .where(and(eq(schema.recurringStreams.userId, userId), isNull(schema.recurringStreams.dismissedAt))),
  ]);

  const categories = new Map<string, YearRankInput>();
  for (const row of breakdowns.flat()) {
    const c = categories.get(row.key);
    if (c) c.total += row.total;
    else categories.set(row.key, { ...row });
  }

  // Net worth: the first snapshot in the year (or the last before it, for history that began earlier), and now.
  await computeAndStoreNetWorthSnapshot(userId, today);
  const snap = { asOfDate: schema.netWorthSnapshots.asOfDate, net: schema.netWorthSnapshots.net };
  const mine = eq(schema.netWorthSnapshots.userId, userId);
  const [[before], [first], [latest]] = await Promise.all([
    db.select(snap).from(schema.netWorthSnapshots).where(and(mine, lt(schema.netWorthSnapshots.asOfDate, start))).orderBy(desc(schema.netWorthSnapshots.asOfDate)).limit(1),
    db.select(snap).from(schema.netWorthSnapshots).where(and(mine, gte(schema.netWorthSnapshots.asOfDate, start))).orderBy(asc(schema.netWorthSnapshots.asOfDate)).limit(1),
    db.select(snap).from(schema.netWorthSnapshots).where(and(mine, lt(schema.netWorthSnapshots.asOfDate, end))).orderBy(desc(schema.netWorthSnapshots.asOfDate)).limit(1),
  ]);
  const startSnap = before ?? first;

  return buildYearReview({
    year,
    today,
    months: totals,
    categories: [...categories.values()],
    merchants: merchantRows.map((m) => ({ key: m.label, label: m.label, colorSlot: m.colorSlot, total: Number(m.total), count: m.count })),
    netWorthStart: startSnap && latest ? { date: startSnap.asOfDate, net: startSnap.net } : null,
    netWorthNow: latest?.net ?? 0,
    subscriptions: subscriptionsMonthlyTotal(streams.filter(isActiveExpenseStream)),
    transactionCount: counted?.count ?? 0,
  });
}
