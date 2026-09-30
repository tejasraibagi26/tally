import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireUserId } from "@/lib/session";
import { z } from "zod";
import { normalizeMerchantKey } from "@tally/core/recurringDetection";
import { shiftDateByMonths } from "@tally/core/budgetMath";
import { excludeAmortizedRealCharges, generateDueManualBillPaymentsForAllStreams, resetCurrentInstallments } from "@/lib/recurringBillGeneration";

// Optional -- how many months this charge covers and gets spread across
// (recurringStreams.amortizeMonths). Omitted = 12, the original annual case,
// so older clients that POST with no body keep working unchanged.
const bodySchema = z.object({
  months: z.union([z.literal(3), z.literal(6), z.literal(9), z.literal(12)]).optional(),
});

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
  const parsedBody = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsedBody.success) {
    return NextResponse.json({ error: "Invalid request", issues: parsedBody.error.issues }, { status: 400 });
  }
  const months = parsedBody.data.months ?? 12;

  const [txn] = await db.select().from(schema.transactions).where(eq(schema.transactions.id, id)).limit(1);
  if (!txn || txn.userId !== userId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const merchantKey = normalizeMerchantKey(txn.merchantName ?? txn.name);

  const [existing] = await db
    .select({
      id: schema.recurringStreams.id,
      lastDate: schema.recurringStreams.lastDate,
      amortizeMonthly: schema.recurringStreams.amortizeMonthly,
      amortizeMonths: schema.recurringStreams.amortizeMonths,
    })
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
  const predictedNextDate = shiftDateByMonths(lastDate, months);
  // The enum has no 6/9-month cadence; "quarterly" fits a 3-month term and
  // "annual" stays the label for the rest (amortizeMonths is what actually
  // drives the spread and the next due date).
  const frequency = months === 3 ? ("quarterly" as const) : ("annual" as const);

  const [stream] = existing
    ? await db
        .update(schema.recurringStreams)
        .set({
          frequency,
          amortizeMonthly: true,
          amortizeMonths: months,
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
          frequency,
          lastDate: txn.postedDate,
          predictedNextDate,
          status: "active",
          transactionIds: [txn.id],
          amortizeMonthly: true,
          amortizeMonths: months,
        })
        .returning();

  if (!stream) {
    return NextResponse.json({ error: "Failed to mark as annual" }, { status: 500 });
  }

  // Re-marked with a different term: the current term's installments were
  // posted at the old amount/labels -- clear them so they're re-posted.
  if (existing?.amortizeMonthly && existing.amortizeMonths !== months) {
    await resetCurrentInstallments(stream.id, stream.lastDate);
  }

  await excludeAmortizedRealCharges(userId);
  const generated = await generateDueManualBillPaymentsForAllStreams(userId);

  return NextResponse.json({ stream, generated });
}
