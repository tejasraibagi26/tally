import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { shiftMonth } from "@/lib/budgetMath";

interface ManualBillStream {
  id: string;
  userId: string;
  accountId: string | null;
  categoryId: string | null;
  description: string | null;
  merchantKey: string;
  averageAmount: number;
  manualNextDueDate: string | null;
}

// A pathological override (a typo'd year, say) shouldn't silently backfill
// years of transactions — this is well beyond any real prepayment stretch.
const MAX_MONTHS = 36;

function currentMonthStart(): string {
  const now = new Date();
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1)).toISOString().slice(0, 10);
}

/**
 * For a manually-added bill (Subscriptions' "+ Add a bill" — never an
 * auto-detected stream, gated by the caller checking isManual) with a
 * manualNextDueDate set: posts one transaction on the 1st of every month
 * from the current month through the month before that due date — the
 * stretch a lump-sum prepayment already covers — so Budgets counts it as
 * spent instead of reading "not yet paid" every month in between. Idempotent
 * (checked by recurringStreamId + postedDate), safe to call repeatedly
 * (right after create/edit, and nightly from cron) without double-posting.
 */
export async function generateDueManualBillPayments(stream: ManualBillStream): Promise<number> {
  if (!stream.accountId || !stream.manualNextDueDate) return 0;

  const candidates: string[] = [];
  let month = currentMonthStart();
  while (month < stream.manualNextDueDate && candidates.length < MAX_MONTHS) {
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

  await db.insert(schema.transactions).values(
    missing.map((postedDate) => ({
      userId: stream.userId,
      accountId: stream.accountId!,
      isPending: false,
      amount: stream.averageAmount,
      currency: account?.currency ?? "USD",
      postedDate,
      name: stream.description ?? stream.merchantKey,
      merchantName: stream.description ?? stream.merchantKey,
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

/** Runs generateDueManualBillPayments for every manually-added stream across every user — the nightly cron's hook into this feature. */
export async function generateDueManualBillPaymentsForAllStreams(): Promise<number> {
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
    })
    .from(schema.recurringStreams)
    .where(eq(schema.recurringStreams.isManual, true));

  let total = 0;
  for (const stream of streams) {
    total += await generateDueManualBillPayments(stream);
  }
  return total;
}
