import { and, eq, or } from "drizzle-orm";
import { db, schema } from "@/db";
import { shiftMonth } from "@tally/core/budgetMath";
import { normalizeMerchantKey } from "@tally/core/recurringDetection";

interface ManualBillStream {
  id: string;
  userId: string;
  accountId: string | null;
  categoryId: string | null;
  description: string | null;
  merchantKey: string;
  averageAmount: number;
  manualNextDueDate: string | null;
  amortizeMonthly?: boolean;
  lastDate?: string | null;
  predictedNextDate?: string | null;
}

// A pathological override (a typo'd year, say) shouldn't silently backfill
// years of transactions — this is well beyond any real prepayment stretch.
const MAX_MONTHS = 36;

function currentMonthStart(): string {
  const now = new Date();
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1)).toISOString().slice(0, 10);
}

/**
 * For a manually-added bill (Subscriptions' "+ Add a bill") with a
 * manualNextDueDate set: posts one full-amount transaction on the 1st of
 * every month from the current month through the month before that due
 * date — the stretch a lump-sum prepayment already covers.
 *
 * For an amortizeMonthly stream (frequency = "annual", confirmed via "mark
 * as annual"): posts averageAmount/12 every month across the whole cycle —
 * from the month of the last real charge (lastDate) through the month
 * before the next one is due (manualNextDueDate ?? predictedNextDate) — so
 * the category's budget sees a steady 1/12 slice instead of one lump month
 * and eleven empty ones. See excludeAmortizedTransactions below for how the
 * real annual charge itself is kept from double-counting alongside these.
 *
 * Idempotent either way (checked by recurringStreamId + postedDate), safe to
 * call repeatedly (right after create/edit, and nightly from cron) without
 * double-posting.
 */
export async function generateDueManualBillPayments(stream: ManualBillStream): Promise<number> {
  if (!stream.accountId) return 0;
  const dueDate = stream.manualNextDueDate ?? (stream.amortizeMonthly ? stream.predictedNextDate : null);
  if (!dueDate) return 0;

  const amortizing = stream.amortizeMonthly === true;
  const amount = amortizing ? Math.round(stream.averageAmount / 12) : stream.averageAmount;
  // A manual bill only ever generates forward from today. An amortizeMonthly
  // stream backfills the whole cycle from the last real charge's month
  // (lastDate) so months already closed in Budgets get their 1/12 slice too,
  // once that real charge is excluded from spend — see excludeAmortizedRealCharges.
  const startMonth = amortizing && stream.lastDate ? stream.lastDate.slice(0, 7) + "-01" : currentMonthStart();

  const candidates: string[] = [];
  let month = startMonth;
  while (month < dueDate && candidates.length < MAX_MONTHS) {
    candidates.push(month);
    month = shiftMonth(month, 1);
  }
  if (candidates.length === 0) return 0;

  const existing = await db
    .select({ postedDate: schema.transactions.postedDate })
    .from(schema.transactions)
    .where(and(eq(schema.transactions.recurringStreamId, stream.id), eq(schema.transactions.userId, stream.userId)));
  const existingDates = new Set(existing.map((r) => r.postedDate));

  const missing = candidates.filter((d) => !existingDates.has(d));
  if (missing.length === 0) return 0;

  const [account] = await db
    .select({ currency: schema.accounts.currency })
    .from(schema.accounts)
    .where(eq(schema.accounts.id, stream.accountId))
    .limit(1);

  const label = amortizing ? `${stream.description ?? stream.merchantKey} (1/12)` : stream.description ?? stream.merchantKey;

  await db.insert(schema.transactions).values(
    missing.map((postedDate) => ({
      userId: stream.userId,
      accountId: stream.accountId!,
      isPending: false,
      amount,
      currency: account?.currency ?? "USD",
      postedDate,
      name: label,
      merchantName: label,
      categoryId: stream.categoryId,
      categorySource: "manual" as const,
      isTransfer: false,
      excludedFromBudget: false,
      reviewed: true,
      isManual: true,
      recurringStreamId: stream.id,
    })),
  );

  return missing.length;
}

/** Runs generateDueManualBillPayments for every manually-added or amortizeMonthly stream, optionally scoped to one user (post-sync/post-detection); unscoped is the nightly cron's hook into this feature. */
export async function generateDueManualBillPaymentsForAllStreams(userId?: string): Promise<number> {
  const streams = await db
    .select({
      id: schema.recurringStreams.id,
      userId: schema.recurringStreams.userId,
      accountId: schema.recurringStreams.accountId,
      categoryId: schema.recurringStreams.categoryId,
      description: schema.recurringStreams.description,
      merchantKey: schema.recurringStreams.merchantKey,
      averageAmount: schema.recurringStreams.averageAmount,
      manualNextDueDate: schema.recurringStreams.manualNextDueDate,
      amortizeMonthly: schema.recurringStreams.amortizeMonthly,
      lastDate: schema.recurringStreams.lastDate,
      predictedNextDate: schema.recurringStreams.predictedNextDate,
    })
    .from(schema.recurringStreams)
    .where(
      and(
        or(eq(schema.recurringStreams.isManual, true), eq(schema.recurringStreams.amortizeMonthly, true)),
        userId ? eq(schema.recurringStreams.userId, userId) : undefined,
      ),
    );

  let total = 0;
  for (const stream of streams) {
    total += await generateDueManualBillPayments(stream);
  }
  return total;
}

/**
 * Keeps the real, Plaid-synced annual charge for an amortizeMonthly stream
 * from double-counting alongside the /12 synthetic installments above: any
 * non-synthetic transaction (isManual = false) matching the stream's
 * account + merchant + amount band gets excludedFromBudget set and is
 * linked back via recurringStreamId. Safe to re-run — only touches rows that
 * aren't already excluded/linked.
 */
function amountBand(amountCents: number): number {
  return Math.round(Math.abs(amountCents) / 100);
}

export async function excludeAmortizedRealCharges(userId: string): Promise<number> {
  const streams = await db
    .select({
      id: schema.recurringStreams.id,
      accountId: schema.recurringStreams.accountId,
      merchantKey: schema.recurringStreams.merchantKey,
      averageAmount: schema.recurringStreams.averageAmount,
    })
    .from(schema.recurringStreams)
    .where(and(eq(schema.recurringStreams.userId, userId), eq(schema.recurringStreams.amortizeMonthly, true)));

  let total = 0;
  for (const stream of streams) {
    if (!stream.accountId) continue;
    const rows = await db
      .select({ id: schema.transactions.id, merchantName: schema.transactions.merchantName, name: schema.transactions.name, amount: schema.transactions.amount })
      .from(schema.transactions)
      .where(
        and(
          eq(schema.transactions.userId, userId),
          eq(schema.transactions.accountId, stream.accountId),
          eq(schema.transactions.isManual, false),
          eq(schema.transactions.excludedFromBudget, false),
        ),
      );

    // Same $1 amount-band match recurringDetection.ts uses — merchant alone
    // isn't enough (a one-off Amazon.com order shouldn't get swept up
    // alongside an Amazon Prime annual renewal just for sharing a merchant).
    const streamBand = amountBand(stream.averageAmount);
    const matchIds = rows
      .filter((r) => normalizeMerchantKey(r.merchantName ?? r.name) === stream.merchantKey && amountBand(r.amount) === streamBand)
      .map((r) => r.id);
    if (matchIds.length === 0) continue;

    for (const id of matchIds) {
      await db
        .update(schema.transactions)
        .set({ excludedFromBudget: true, recurringStreamId: stream.id })
        .where(eq(schema.transactions.id, id));
    }
    total += matchIds.length;
  }
  return total;
}
