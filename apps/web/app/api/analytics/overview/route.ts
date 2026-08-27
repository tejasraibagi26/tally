import { NextResponse } from "next/server";
import { eq, desc } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireUserId } from "@/lib/session";
import { getBudgetsForMonth } from "@/lib/budgets";
import { upcomingBills } from "@/lib/analytics";

function currentMonth(): string {
  const now = new Date();
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1)).toISOString().slice(0, 10);
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
  const month = monthParam && /^\d{4}-\d{2}-01$/.test(monthParam) ? monthParam : currentMonth();

  const [latestSnapshot] = await db
    .select()
    .from(schema.netWorthSnapshots)
    .where(eq(schema.netWorthSnapshots.userId, userId))
    .orderBy(desc(schema.netWorthSnapshots.asOfDate))
    .limit(1);

  const [budgets, bills] = await Promise.all([getBudgetsForMonth(userId, month), upcomingBills(userId)]);

  const totalBudgeted = budgets.reduce((s, b) => s + b.amount + b.rolloverFromPrior, 0);
  const totalSpend = budgets.reduce((s, b) => s + b.spend, 0);

  return NextResponse.json({
    month,
    netWorth: latestSnapshot ?? null,
    budgets: { totalBudgeted, totalSpend, remaining: totalBudgeted - totalSpend, categories: budgets },
    upcomingBills: bills,
  });
}
