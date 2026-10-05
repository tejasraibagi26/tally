import { NextResponse } from "next/server";
import { and, eq, desc, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireUserId } from "@/lib/session";
import { getBudgetsForMonth } from "@/lib/budgets";
import { upcomingBills } from "@/lib/analytics";
import { currentMonthFor } from "@/lib/userTimezone";

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
    // The review queue's own rule (app/api/transactions/review): unreviewed,
    // non-transfer, any date -- so Overview's count matches what the queue opens with.
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.transactions)
      .where(and(eq(schema.transactions.userId, userId), eq(schema.transactions.reviewed, false), eq(schema.transactions.isTransfer, false))),
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
