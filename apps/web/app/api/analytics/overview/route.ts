import { NextResponse } from "next/server";
import { eq, desc } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireUserId } from "@/lib/session";
import { getBudgetsForMonth } from "@/lib/budgets";
import { dailySpend, upcomingBills } from "@/lib/analytics";
import { todayFor } from "@/lib/userTimezone";
import { monthLastDay } from "@tally/core/budgetMath";
import { onPaceStreak } from "@tally/core/popView";

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
  const today = await todayFor(userId);
  const currentMonth = today.slice(0, 7) + "-01";
  const month = monthParam && /^\d{4}-\d{2}-01$/.test(monthParam) ? monthParam : currentMonth;

  const [latestSnapshot] = await db
    .select()
    .from(schema.netWorthSnapshots)
    .where(eq(schema.netWorthSnapshots.userId, userId))
    .orderBy(desc(schema.netWorthSnapshots.asOfDate))
    .limit(1);

  const [budgets, bills] = await Promise.all([getBudgetsForMonth(userId, month), upcomingBills(userId)]);

  const totalBudgeted = budgets.reduce((s, b) => s + b.amount + b.rolloverFromPrior, 0);
  const totalSpend = budgets.reduce((s, b) => s + b.spend, 0);

  // Tally Pop's on-pace streak (web Overview's OnPaceCard; @tally/core/popView):
  // this month only, and only with a budget to pace against.
  let onPace: { streak: number; dailyPace: number } | null = null;
  if (month === currentMonth && totalBudgeted > 0) {
    const daysInMonth = Number(monthLastDay(month).slice(8, 10));
    const dailyPace = Math.floor(totalBudgeted / daysInMonth);
    onPace = { streak: onPaceStreak(await dailySpend(userId, month), dailyPace, today, month), dailyPace };
  }

  return NextResponse.json({
    month,
    netWorth: latestSnapshot ?? null,
    budgets: { totalBudgeted, totalSpend, remaining: totalBudgeted - totalSpend, categories: budgets },
    upcomingBills: bills,
    onPace,
  });
}
