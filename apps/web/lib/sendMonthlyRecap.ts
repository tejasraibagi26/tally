import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { monthTotals } from "@/lib/analytics";
import { computeMonthlyRecap } from "@/lib/monthlyRecap";
import { renderMonthInReviewEmail } from "@/lib/emailTemplate";
import { sendEmail } from "@/lib/emailService";
import { unsubscribeToken } from "@/lib/emailUnsubscribe";

export interface RecapEnv {
  appUrl: string;
  companyName?: string;
  companyAddress?: string;
}

export interface SendRecapOptions {
  /** Skip if monthlyRecaps already has a sentAt for this (userId, month). Default true. */
  checkAlreadySent?: boolean;
  /** Skip if the month has zero income and zero spend. Default true. */
  checkActivity?: boolean;
  /** Upsert the monthlyRecaps row (sentAt, yearsToFire) on success. Default true. */
  recordSend?: boolean;
}

export type SendRecapResult =
  | { status: "sent"; month: string; monthLabel: string }
  | { status: "skipped"; reason: "already_sent" | "no_accounts" | "no_activity" };

/**
 * The one place that computes + renders + sends a monthly recap for a single
 * user — shared by the cron job (app/api/cron/monthly-recap) and the
 * "send me a test recap" button (app/api/settings/recaps/test), so both go
 * through identical logic. The test button opts out of all three checks
 * (`checkAlreadySent`/`checkActivity`/`recordSend`) so it can preview any
 * month on demand without touching idempotency state or requiring the
 * target month to already have activity.
 */
export async function sendMonthlyRecapForUser(
  user: { id: string; email: string },
  month: string,
  env: RecapEnv,
  opts: SendRecapOptions = {},
): Promise<SendRecapResult> {
  const { checkAlreadySent = true, checkActivity = true, recordSend = true } = opts;

  if (checkAlreadySent) {
    const [alreadySent] = await db
      .select({ sentAt: schema.monthlyRecaps.sentAt })
      .from(schema.monthlyRecaps)
      .where(and(eq(schema.monthlyRecaps.userId, user.id), eq(schema.monthlyRecaps.month, month)))
      .limit(1);
    if (alreadySent?.sentAt) return { status: "skipped", reason: "already_sent" };
  }

  const accounts = await db.query.accounts.findMany({ where: eq(schema.accounts.userId, user.id) });
  if (accounts.length === 0) return { status: "skipped", reason: "no_accounts" };

  if (checkActivity) {
    const { income, spend } = await monthTotals(user.id, month);
    if (income === 0 && spend === 0) return { status: "skipped", reason: "no_activity" };
  }

  const data = await computeMonthlyRecap(user.id, month);
  const html = renderMonthInReviewEmail(data, {
    appUrl: env.appUrl,
    preferencesUrl: `${env.appUrl}/settings`,
    unsubscribeUrl: `${env.appUrl}/api/email/unsubscribe?uid=${user.id}&token=${unsubscribeToken(user.id)}`,
    companyName: env.companyName,
    companyAddress: env.companyAddress,
  });

  await sendEmail({ to: user.email, subject: `Your ${data.monthLabel} recap`, html });

  if (recordSend) {
    const yearsToFire = data.fire ? data.fire.yearsToGo.toFixed(2) : null;
    const values = { userId: user.id, month, yearsToFire, sentAt: new Date() };
    await db
      .insert(schema.monthlyRecaps)
      .values(values)
      .onConflictDoUpdate({ target: [schema.monthlyRecaps.userId, schema.monthlyRecaps.month], set: values });
  }

  return { status: "sent", month, monthLabel: data.monthLabel };
}
