import { NextResponse } from "next/server";
import { and, eq, desc, gte, lt, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireUserId } from "@/lib/session";
import { getBudgetsForMonth } from "@/lib/budgets";
import { upcomingBills } from "@/lib/analytics";
import { currentMonthFor } from "@/lib/userTimezone";

/** YYYY-MM-01 of the month after `month` (itself YYYY-MM-01). */
function nextMonthStart(month: string): string {
  const y = Number(month.slice(0, 4));
  const m = Number(month.slice(5, 7));
  return m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`;
}

// §9's headline figures, bundled — the Overview page itself reads these
// straight from the DB (no network round trip); this route exists for
// external/programmatic use per WORK.md §10.
export async function GET(req: Request) {
  let userId: string;
  try {
    userId = await requireUserId(req);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const monthParam = new URL(req.url).searchParams.get("month");
  const month = monthParam && /^\d{4}-\d{2}-01$/.test(monthParam) ? monthParam : (await currentMonthFor(userId));

  const [latestSnapshot] = await db
    .select()
    .from(schema.netWorthSnapshots)
    .where(eq(schema.netWorthSnapshots.userId, userId))
    .orderBy(desc(schema.netWorthSnapshots.asOfDate))
    .limit(1);

  const [budgets, bills, [unreviewedRow]] = await Promise.all([
    getBudgetsForMonth(userId, month),
    upcomingBills(userId),
    // Unreviewed, non-transfer transactions posted this month -- the review
    // queue's rule, limited to the month so the count matches the Transactions
    // tab's "N to review" banner.
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.transactions)
      .where(
        and(
          eq(schema.transactions.userId, userId),
          eq(schema.transactions.reviewed, false),
          eq(schema.transactions.isTransfer, false),
          gte(schema.transactions.postedDate, month),
          lt(schema.transactions.postedDate, nextMonthStart(month)),
        ),
      ),
  ]);

  const totalBudgeted = budgets.reduce((s, b) => s + b.amount + b.rolloverFromPrior, 0);
  const totalSpend = budgets.reduce((s, b) => s + b.spend, 0);

  return NextResponse.json({
    month,
    netWorth: latestSnapshot ?? null,
    budgets: { totalBudgeted, totalSpend, remaining: totalBudgeted - totalSpend, categories: budgets },
    upcomingBills: bills,
    unreviewed: unreviewedRow?.count ?? 0,
  });
}
