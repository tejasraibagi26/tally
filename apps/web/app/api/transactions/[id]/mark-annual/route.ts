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
  const predictedNextDate = addDays(txn.postedDate, 365);

  const [existing] = await db
    .select({ id: schema.recurringStreams.id, lastDate: schema.recurringStreams.lastDate, predictedNextDate: schema.recurringStreams.predictedNextDate })
    .from(schema.recurringStreams)
    .where(and(eq(schema.recurringStreams.userId, userId), eq(schema.recurringStreams.merchantKey, merchantKey), eq(schema.recurringStreams.accountId, txn.accountId)))
    .limit(1);

  const [stream] = existing
    ? await db
        .update(schema.recurringStreams)
        .set({
          frequency: "annual",
          amortizeMonthly: true,
          categoryId: txn.categoryId,
          averageAmount: txn.amount,
          // Keep detection's own dates if it already has some — a single
          // manually-marked transaction shouldn't regress a stream detection
          // already anchored with real data.
          lastDate: existing.lastDate ?? txn.postedDate,
          predictedNextDate: existing.predictedNextDate ?? predictedNextDate,
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
