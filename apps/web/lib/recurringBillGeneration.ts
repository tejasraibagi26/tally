import { and, eq, inArray, or } from "drizzle-orm";
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
 * as annual"): posts averageAmount/12 every month, starting this month —
 * never backfilling months that already closed before the user tracked it,
 * and never front-loading months that haven't happened yet (a "(9/12)"
 * transaction dated a year in the future is meaningless and was showing up
 * ahead of real activity in Overview's date-sorted Recent Activity). Instead
 * each month's installment gets created once that month actually arrives —
 * this function already runs on every sync and nightly from cron, so a
 * future month is never more than a day late once it's current. See
 * excludeAmortizedRealCharges for how the real annual charge itself is kept
 * from double-counting alongside these.
 *
 * Idempotent either way (checked by recurringStreamId + postedDate), safe to
 * call repeatedly (right after create/edit, and nightly from cron) without
 * double-posting.
 */
export async function generateDueManualBillPayments(stream: ManualBillStream): Promise<number> {
  if (!stream.accountId) return 0;
  let dueDate = stream.manualNextDueDate ?? (stream.amortizeMonthly ? stream.predictedNextDate : null);
  if (!dueDate) return 0;

  const amortizing = stream.amortizeMonthly === true;
  const amount = amortizing ? Math.round(stream.averageAmount / 12) : stream.averageAmount;
  const startMonth = currentMonthStart();

  // Self-heals a stale predictedNextDate inherited from a stream that
  // existed under some other (non-annual) cadence before amortizeMonthly
  // was turned on — without this, a due date left in the past or only a
  // few weeks out silently produces zero candidate months below, forever,
  // since there's no user-facing way to retrigger this once a transaction
  // already shows "Marked as annual."
  if (amortizing && dueDate <= startMonth) {
    dueDate = shiftMonth(startMonth, 12);
  }

  // Compared against the due date's own month-start (not the raw due date)
  // for the amortizing path specifically, so a due date that isn't the 1st
  // (e.g. "2027-08-15") doesn't pull in one extra trailing month — 13
  // installments instead of 12. Left as a raw-date comparison for the
  // pre-existing manual-bill path to avoid changing behavior nothing here
  // asked to touch.
  const upperBound = amortizing ? dueDate.slice(0, 7) + "-01" : dueDate;

  // The full cycle (for correct "(n/total)" labeling below) vs. what's
  // actually safe to insert right now — amortizing never creates a row
  // beyond the current month; manual bills keep generating the whole
  // prepaid stretch at once, since those future months are already paid for.
  const insertUpperBound = amortizing ? shiftMonth(startMonth, 1) : upperBound;

  const candidates: string[] = [];
  let month = startMonth;
  while (month < upperBound && candidates.length < MAX_MONTHS) {
    candidates.push(month);
    month = shiftMonth(month, 1);
  }
  if (candidates.length === 0) return 0;
  const toInsert = candidates.filter((m) => m < insertUpperBound);
  if (toInsert.length === 0) return 0;

  // isManual: true is load-bearing here, not just descriptive — an
  // amortizing stream's real (isManual: false) charge also carries this
  // stream's recurringStreamId once excludeAmortizedRealCharges excludes it,
  // and none of the cleanup/relabel/dedup logic below may ever touch that
  // row. Only this function's own synthetic installments should be in play.
  const existing = await db
    .select({ id: schema.transactions.id, postedDate: schema.transactions.postedDate, name: schema.transactions.name, createdAt: schema.transactions.createdAt })
    .from(schema.transactions)
    .where(and(eq(schema.transactions.recurringStreamId, stream.id), eq(schema.transactions.userId, stream.userId), eq(schema.transactions.isManual, true)));

  // Each installment's position is its index within the full cycle
  // (candidates), not within `missing`/`toInsert` — a later cron run
  // backfilling just one late month must still label it correctly (e.g.
  // "(9/12)"), not "(1/1)" for whatever happens to be missing that day.
  const totalMonths = candidates.length;
  function labelFor(postedDate: string): string {
    if (!amortizing) return stream.description ?? stream.merchantKey;
    const index = candidates.indexOf(postedDate) + 1;
    return `${stream.description ?? stream.merchantKey} (${index}/${totalMonths})`;
  }

  let badIds = new Set<string>();
  if (amortizing) {
    // One-time cleanup for rows an earlier version of this function
    // bulk-frontloaded (a whole year at once, backfilling past months and
    // pre-creating future ones) before the "never generate beyond the
    // current month" rule existed. Can't identify those by comparing
    // postedDate against *this* run's startMonth — that moves forward every
    // month, so it would just as happily flag a legitimately-created row
    // from last month as "stale" once the calendar advances, silently
    // deleting real history. createdAt vs. postedDate's own month is a
    // signal that stays true forever instead: the new code only ever
    // inserts a row within the same month it's dated for, so any row whose
    // insert month doesn't match its own postedDate month can only be a
    // leftover from that old bulk-insert behavior.
    badIds = new Set(existing.filter((r) => r.postedDate.slice(0, 7) !== r.createdAt.toISOString().slice(0, 7)).map((r) => r.id));
    if (badIds.size > 0) {
      await db.delete(schema.transactions).where(inArray(schema.transactions.id, [...badIds]));
    }
    // Relabeling (every row used to get a hardcoded "(1/12)" regardless of
    // its actual position) is scoped the same way — only this run's single
    // current-month candidate has a total/index that's actually still
    // valid; a genuinely past row's original cycle length isn't
    // recomputable from here.
    for (const row of existing) {
      if (badIds.has(row.id) || row.postedDate < startMonth || row.postedDate >= insertUpperBound) continue;
      const correctLabel = labelFor(row.postedDate);
      if (row.name !== correctLabel) {
        await db.update(schema.transactions).set({ name: correctLabel, merchantName: correctLabel }).where(eq(schema.transactions.id, row.id));
      }
    }
  }

  const existingDates = new Set(existing.filter((r) => !badIds.has(r.id)).map((r) => r.postedDate));
  const missing = toInsert.filter((d) => !existingDates.has(d));
  if (missing.length === 0) return 0;

  const [account] = await db
    .select({ currency: schema.accounts.currency })
    .from(schema.accounts)
    .where(eq(schema.accounts.id, stream.accountId))
    .limit(1);

  await db.insert(schema.transactions).values(
    missing.map((postedDate) => ({
      userId: stream.userId,
      accountId: stream.accountId!,
      isPending: false,
      amount,
      currency: account?.currency ?? "USD",
      postedDate,
      name: labelFor(postedDate),
      merchantName: labelFor(postedDate),
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
