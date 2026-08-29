import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { isAuthorizedCronRequest } from "@/lib/cronAuth";
import { shiftMonth } from "@tally/core/budgetMath";
import { monthTotals } from "@/lib/analytics";
import { computeMonthlyRecap } from "@/lib/monthlyRecap";
import { renderMonthInReviewEmail } from "@/lib/emailTemplate";
import { sendEmail } from "@/lib/emailService";
import { unsubscribeToken } from "@/lib/emailUnsubscribe";

export const maxDuration = 300;

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
 */
export async function GET(req: Request) {
  if (!isAuthorizedCronRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const appUrl = process.env.APP_URL;
  if (!appUrl) {
    return NextResponse.json({ error: "APP_URL not configured" }, { status: 500 });
  }
  // Optional — this is an internal tool, not a commercial mailer, so there's
  // no CAN-SPAM obligation to publish a physical address. renderMonthInReviewEmail
  // omits the footer's company/address line entirely when either is unset.
  const companyName = process.env.COMPANY_NAME;
  const companyAddress = process.env.COMPANY_ADDRESS;

  const month = shiftMonth(currentMonth(), -1);

  const users = await db
    .select({ id: schema.users.id, email: schema.users.email })
    .from(schema.users)
    .where(eq(schema.users.recapsEnabled, true));

  let sent = 0;
  let skipped = 0;
  const failures: RecapFailure[] = [];

  for (const user of users) {
    try {
      const [alreadySent] = await db
        .select({ sentAt: schema.monthlyRecaps.sentAt })
        .from(schema.monthlyRecaps)
        .where(and(eq(schema.monthlyRecaps.userId, user.id), eq(schema.monthlyRecaps.month, month)))
        .limit(1);
      if (alreadySent?.sentAt) {
        skipped++;
        continue;
      }

      const accounts = await db.query.accounts.findMany({ where: eq(schema.accounts.userId, user.id) });
      if (accounts.length === 0) {
        skipped++;
        continue;
      }

      // Nothing meaningful to recap for a month with zero income and zero
      // spend — skip rather than send an empty-looking email.
      const { income, spend } = await monthTotals(user.id, month);
      if (income === 0 && spend === 0) {
        skipped++;
        continue;
      }

      const data = await computeMonthlyRecap(user.id, month);
      const html = renderMonthInReviewEmail(data, {
        appUrl,
        preferencesUrl: `${appUrl}/settings`,
        unsubscribeUrl: `${appUrl}/api/email/unsubscribe?uid=${user.id}&token=${unsubscribeToken(user.id)}`,
        companyName,
        companyAddress,
      });

      await sendEmail({ to: user.email, subject: `Your ${data.monthLabel} recap`, html });

      const yearsToFire = data.fire ? data.fire.yearsToGo.toFixed(2) : null;
      const values = { userId: user.id, month, yearsToFire, sentAt: new Date() };
      await db
        .insert(schema.monthlyRecaps)
        .values(values)
        .onConflictDoUpdate({ target: [schema.monthlyRecaps.userId, schema.monthlyRecaps.month], set: values });

      sent++;
    } catch (err) {
      console.error(`Cron monthly-recap: failed for user ${user.id}`, err);
      failures.push({ userId: user.id, error: err instanceof Error ? err.message : String(err) });
    }
  }

  return NextResponse.json({ ok: true, month, sent, skipped, failures });
}
