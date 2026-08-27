import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { duePayDates, type DayAnchor } from "@tally/core/incomeScheduleMath";

interface ScheduleRow {
  id: string;
  userId: string;
  accountId: string;
  categoryId: string | null;
  label: string;
  amount: number;
  dayAnchors: DayAnchor[];
}

/**
 * Inserts a manual, isManual transaction for every pay date this schedule's
 * anchors resolve to at or before `throughDate` that doesn't already have
 * one — idempotent by construction (checked against incomeScheduleId +
 * postedDate), so it's safe to call this repeatedly (once right after the
 * schedule is created/edited, and again every night from cron) without ever
 * double-posting a paycheck. `monthsBack` controls how far back the catch-up
 * window reaches; the nightly cron only needs last month's stragglers, but
 * a schedule created mid-cycle may need to backfill further.
 */
export async function generateDuePaychecks(schedule: ScheduleRow, throughDate: string, monthsBack = 1): Promise<number> {
  const candidates = duePayDates(schedule.dayAnchors, throughDate, monthsBack);
  if (candidates.length === 0) return 0;

  const existing = await db
    .select({ postedDate: schema.transactions.postedDate })
    .from(schema.transactions)
    .where(and(eq(schema.transactions.incomeScheduleId, schedule.id), eq(schema.transactions.userId, schedule.userId)));
  const existingDates = new Set(existing.map((r) => r.postedDate));

  const missing = candidates.filter((d) => !existingDates.has(d));
  if (missing.length === 0) return 0;

  const [account] = await db
    .select({ currency: schema.accounts.currency })
    .from(schema.accounts)
    .where(eq(schema.accounts.id, schedule.accountId))
    .limit(1);

  await db.insert(schema.transactions).values(
    missing.map((postedDate) => ({
      userId: schedule.userId,
      accountId: schedule.accountId,
      isPending: false,
      amount: schedule.amount,
      currency: account?.currency ?? "USD",
      postedDate,
      name: schedule.label,
      merchantName: schedule.label,
      categoryId: schedule.categoryId,
      categorySource: "manual" as const,
      isTransfer: false,
      excludedFromBudget: false,
      reviewed: true,
      isManual: true,
      incomeScheduleId: schedule.id,
    })),
  );

  return missing.length;
}

/** Runs generateDuePaychecks for every active schedule across every user — the nightly cron's hook into this feature. */
export async function generateDuePaychecksForAllActiveSchedules(throughDate: string): Promise<number> {
  const schedules = await db
    .select({
      id: schema.incomeSchedules.id,
      userId: schema.incomeSchedules.userId,
      accountId: schema.incomeSchedules.accountId,
      categoryId: schema.incomeSchedules.categoryId,
      label: schema.incomeSchedules.label,
      amount: schema.incomeSchedules.amount,
      dayAnchors: schema.incomeSchedules.dayAnchors,
    })
    .from(schema.incomeSchedules)
    .where(eq(schema.incomeSchedules.active, true));

  let total = 0;
  for (const schedule of schedules) {
    total += await generateDuePaychecks(schedule, throughDate);
  }
  return total;
}
