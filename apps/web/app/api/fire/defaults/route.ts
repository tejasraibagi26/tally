import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireUserId } from "@/lib/session";
import { trailingAnnualCashFlowEstimate } from "@/lib/analytics";

// Backs the mobile FIRE calculator with the same server-computed defaults
// apps/web/app/(app)/fire/page.tsx seeds its <FireCalculator> with -- mobile
// had no way to reach investableNetWorth/trailingAnnualCashFlowEstimate/
// birthDate before this, so it fell back to hardcoded $60k/$2k placeholders
// regardless of the user's actual data.
export async function GET(req: Request) {
  let userId: string;
  try {
    userId = await requireUserId(req);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const accounts = await db.query.accounts.findMany({ where: eq(schema.accounts.userId, userId) });
  const investableNetWorth = accounts.filter((a) => a.type === "investment").reduce((sum, a) => sum + (a.currentBalance ?? 0), 0);

  const { income, expenses: defaultAnnualExpenses } = await trailingAnnualCashFlowEstimate(userId, 12);
  const defaultMonthlyContribution = Math.max(0, Math.round((income - defaultAnnualExpenses) / 12));

  const [user] = await db.select({ birthDate: schema.users.birthDate }).from(schema.users).where(eq(schema.users.id, userId)).limit(1);

  return NextResponse.json({
    hasAccounts: accounts.length > 0,
    investableNetWorth,
    defaultAnnualExpenses,
    defaultMonthlyContribution,
    birthDate: user?.birthDate ?? null,
    today: new Date().toISOString().slice(0, 10),
  });
}
