import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireUserId } from "@/lib/session";
import { fireInputs } from "@/lib/fire";
import { todayFor } from "@/lib/userTimezone";

// Everything the mobile planner seeds from, via the same lib/fire.ts helper
// as the web page. investableNetWorth now honours excluded accounts and
// converts every account to CAD; accounts, coveredMonths and settings are
// new (older mobile builds ignore them).
export async function GET(req: Request) {
  let userId: string;
  try {
    userId = await requireUserId(req);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [inputs, [user], anyAccount, today] = await Promise.all([
    fireInputs(userId),
    db.select({ birthDate: schema.users.birthDate }).from(schema.users).where(eq(schema.users.id, userId)).limit(1),
    db.query.accounts.findFirst({ where: eq(schema.accounts.userId, userId) }),
    todayFor(userId),
  ]);

  return NextResponse.json({
    hasAccounts: !!anyAccount,
    investableNetWorth: inputs.investedToday,
    defaultAnnualExpenses: inputs.defaultAnnualExpenses,
    defaultMonthlyContribution: inputs.defaultMonthlyContribution,
    coveredMonths: inputs.coveredMonths,
    accounts: inputs.accounts,
    birthDate: user?.birthDate ?? null,
    today,
  });
}
