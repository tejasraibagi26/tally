import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireUserId } from "@/lib/session";
import { normalizeMerchantKey } from "@tally/core/recurringDetection";
import { excludeAmortizedRealCharges, generateDueManualBillPaymentsForAllStreams } from "@/lib/recurringBillGeneration";

function addDays(date: string, days: number): string {
  const d = new Date(date + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// "Mark as annual subscription" — the path for a subscription
// detectRecurringForUser can't have found on its own yet (brand new, or only
// one charge so far, so even the 2-occurrence annual-pair case in
// recurringDetection.ts has nothing to cluster against). Creates or updates
// the recurringStreams row for this transaction's merchant/account directly
// with amortizeMonthly = true, rather than waiting on detection to catch up.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  let userId: string;
  try {
    userId = await requireUserId(req);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const [txn] = await db.select().from(schema.transactions).where(eq(schema.transactions.id, id)).limit(1);
  if (!txn || txn.userId !== userId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const merchantKey = normalizeMerchantKey(txn.merchantName ?? txn.name);

  const [existing] = await db
    .select({ id: schema.recurringStreams.id, lastDate: schema.recurringStreams.lastDate })
    .from(schema.recurringStreams)
    .where(and(eq(schema.recurringStreams.userId, userId), eq(schema.recurringStreams.merchantKey, merchantKey), eq(schema.recurringStreams.accountId, txn.accountId)))
    .limit(1);

  // The most recent of the two known occurrences — an existing stream may
  // predate this transaction (or vice versa) if detection had already
  // clustered this merchant under some other cadence before the user
  // confirmed it's actually annual.
  const lastDate = existing?.lastDate && existing.lastDate > txn.postedDate ? existing.lastDate : txn.postedDate;
  // Always recomputed from that date, never preserved from `existing` — a
  // prior (non-annual) detection pass could have left a predictedNextDate
  // just weeks out, which would make generateDueManualBillPayments's
  // due-date loop produce zero candidate months and silently generate
  // nothing once amortizeMonthly forces it to be read as an annual due date.
  const predictedNextDate = addDays(lastDate, 365);

  const [stream] = existing
    ? await db
        .update(schema.recurringStreams)
        .set({
          frequency: "annual",
          amortizeMonthly: true,
          categoryId: txn.categoryId,
          averageAmount: txn.amount,
          lastDate,
          predictedNextDate,
        })
        .where(eq(schema.recurringStreams.id, existing.id))
        .returning()
    : await db
        .insert(schema.recurringStreams)
        .values({
          userId,
          merchantKey,
          description: txn.merchantName ?? txn.name,
          accountId: txn.accountId,
          categoryId: txn.categoryId,
          averageAmount: txn.amount,
          frequency: "annual",
          lastDate: txn.postedDate,
          predictedNextDate,
          status: "active",
          transactionIds: [txn.id],
          amortizeMonthly: true,
        })
        .returning();

  if (!stream) {
    return NextResponse.json({ error: "Failed to mark as annual" }, { status: 500 });
  }

  await excludeAmortizedRealCharges(userId);
  const generated = await generateDueManualBillPaymentsForAllStreams(userId);

  return NextResponse.json({ stream, generated });
}
