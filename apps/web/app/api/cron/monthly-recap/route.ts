import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { isAuthorizedCronRequest } from "@/lib/cronAuth";
import { shiftMonth } from "@tally/core/budgetMath";
import { sendMonthlyRecapForUser } from "@/lib/sendMonthlyRecap";

export const maxDuration = 300;

const MONTH_RE = /^\d{4}-\d{2}-01$/;

function currentMonth(): string {
  const now = new Date();
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1)).toISOString().slice(0, 10);
}

interface RecapFailure {
  userId: string;
  error: string;
}

/**
 * Runs on the 1st of each month (vercel.json) and sends the recap for the
 * month that just ended — a Sept 1 run covers August. Per-user try/catch
 * (same shape as cron/nightly) so one user's failure doesn't block the rest;
 * `monthlyRecaps.sentAt` makes a retry or accidental re-run idempotent.
 *
 * `?month=YYYY-MM-01` overrides the computed month — for manually testing a
 * specific month via curl/Invoke-RestMethod with the CRON_SECRET header.
 * Still requires that same server-to-server auth; there's no user-facing
 * equivalent of this override (see app/api/settings/recaps/test for that).
 */
export async function GET(req: Request) {
  if (!isAuthorizedCronRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const appUrl = process.env.APP_URL;
  if (!appUrl) {
    return NextResponse.json({ error: "APP_URL not configured" }, { status: 500 });
  }
  const companyName = process.env.COMPANY_NAME;
  const companyAddress = process.env.COMPANY_ADDRESS;

  const monthParam = new URL(req.url).searchParams.get("month");
  if (monthParam && !MONTH_RE.test(monthParam)) {
    return NextResponse.json({ error: "month must be YYYY-MM-01" }, { status: 400 });
  }
  const month = monthParam ?? shiftMonth(currentMonth(), -1);

  const users = await db
    .select({ id: schema.users.id, email: schema.users.email })
    .from(schema.users)
    .where(eq(schema.users.recapsEnabled, true));

  let sent = 0;
  let skipped = 0;
  const failures: RecapFailure[] = [];

  for (const user of users) {
    try {
      const result = await sendMonthlyRecapForUser(user, month, { appUrl, companyName, companyAddress });
      if (result.status === "sent") sent++;
      else skipped++;
    } catch (err) {
      console.error(`Cron monthly-recap: failed for user ${user.id}`, err);
      failures.push({ userId: user.id, error: err instanceof Error ? err.message : String(err) });
    }
  }

  return NextResponse.json({ ok: true, month, sent, skipped, failures });
}
