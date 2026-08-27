import { NextResponse } from "next/server";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireUserId } from "@/lib/session";
import { normalizeMerchantKey } from "@tally/core/recurringDetection";
import { generateDueManualBillPayments } from "@/lib/recurringBillGeneration";

const bodySchema = z.object({
  description: z.string().min(1).max(120),
  accountId: z.string().uuid(),
  categoryId: z.string().uuid().nullable().optional(),
  amount: z.number().int().positive(), // dollars-as-cents magnitude; always stored as an expense (negative)
  manualNextDueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

// A manually-added bill for when the gap-based detector (lib/recurringDetection.ts)
// never produces a row at all — irregular lump-sum payments (rent prepaid
// several months at once) can fail its "at least 3 occurrences with a stable
// interval" bar from the very first payment, so there's nothing in
// Subscriptions to attach a manualNextDueDate override to otherwise.
export async function POST(req: Request) {
  let userId: string;
  try {
    userId = await requireUserId();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request", issues: parsed.error.issues }, { status: 400 });
  }
  const { description, accountId, categoryId, amount, manualNextDueDate } = parsed.data;

  const [account] = await db
    .select({ id: schema.accounts.id, userId: schema.accounts.userId })
    .from(schema.accounts)
    .where(eq(schema.accounts.id, accountId))
    .limit(1);
  if (!account || account.userId !== userId) {
    return NextResponse.json({ error: "Account not found" }, { status: 404 });
  }

  const merchantKey = normalizeMerchantKey(description);
  const [existing] = await db
    .select({ id: schema.recurringStreams.id })
    .from(schema.recurringStreams)
    .where(and(eq(schema.recurringStreams.userId, userId), eq(schema.recurringStreams.merchantKey, merchantKey), eq(schema.recurringStreams.accountId, accountId)))
    .limit(1);
  if (existing) {
    return NextResponse.json({ error: "Already tracked — set its next due date from the list instead of adding it again" }, { status: 409 });
  }

  const [stream] = await db
    .insert(schema.recurringStreams)
    .values({
      userId,
      merchantKey,
      description,
      accountId,
      categoryId: categoryId ?? null,
      averageAmount: -amount,
      frequency: "monthly",
      manualNextDueDate,
      status: "active",
      transactionIds: [],
      isManual: true,
    })
    .returning();
  if (!stream) {
    return NextResponse.json({ error: "Failed to create bill" }, { status: 500 });
  }

  // Immediately backfill every month between now and the due date rather
  // than waiting on the next nightly cron — a prepayment already covers
  // those months, so Budgets should reflect that right away.
  const generated = await generateDueManualBillPayments(stream);

  return NextResponse.json({ stream, generated });
}
