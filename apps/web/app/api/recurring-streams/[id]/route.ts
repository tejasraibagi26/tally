import { NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireUserId } from "@/lib/session";
import { shiftDateByMonths } from "@tally/core/budgetMath";
import { excludeAmortizedRealCharges, generateDueManualBillPayments, resetCurrentInstallments, undoAmortization } from "@/lib/recurringBillGeneration";

const patchSchema = z.object({
  manualNextDueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  // Only meaningful for a frequency = "annual" stream — see schema.ts's
  // recurringStreams.amortizeMonthly doc comment. Backs both the Subscriptions
  // page's "spread across months" toggle and confirming a 2-occurrence
  // annual candidate detectRecurringForUser surfaced on its own.
  amortizeMonthly: z.boolean().optional(),
  // The billing term one charge covers and is spread across (see
  // schema.ts's recurringStreams.amortizeMonths).
  amortizeMonths: z.union([z.literal(3), z.literal(6), z.literal(9), z.literal(12)]).optional(),
  // false restores a stream the user dismissed ("This won't recur" or Remove);
  // detection refreshes its dates on the next run. Dismissing stays DELETE.
  dismissed: z.literal(false).optional(),
});

// Sets or clears manualNextDueDate (schema.ts's override for a recurring
// stream's next-due prediction) — lib/analytics.ts's upcomingBills and the
// Subscriptions page both prefer this over the auto-detected
// predictedNextDate whenever it's set.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  let userId: string;
  try {
    userId = await requireUserId(req);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const [existing] = await db
    .select({
      id: schema.recurringStreams.id,
      userId: schema.recurringStreams.userId,
      amortizeMonthly: schema.recurringStreams.amortizeMonthly,
      amortizeMonths: schema.recurringStreams.amortizeMonths,
      lastDate: schema.recurringStreams.lastDate,
    })
    .from(schema.recurringStreams)
    .where(eq(schema.recurringStreams.id, id))
    .limit(1);
  if (!existing || existing.userId !== userId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const parsed = patchSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request", issues: parsed.error.issues }, { status: 400 });
  }

  const update: Partial<typeof schema.recurringStreams.$inferInsert> = {};
  if (parsed.data.manualNextDueDate !== undefined) update.manualNextDueDate = parsed.data.manualNextDueDate;
  if (parsed.data.amortizeMonthly !== undefined) update.amortizeMonthly = parsed.data.amortizeMonthly;
  if (parsed.data.dismissed === false) update.dismissedAt = null;
  if (parsed.data.amortizeMonths !== undefined) {
    update.amortizeMonths = parsed.data.amortizeMonths;
    // Next charge is one term after the last one (Upcoming bills reads this;
    // detection may re-derive it from real charge gaps later, which is fine).
    if (existing.lastDate) update.predictedNextDate = shiftDateByMonths(existing.lastDate, parsed.data.amortizeMonths);
  }
  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const [stream] = await db
    .update(schema.recurringStreams)
    .set(update)
    .where(eq(schema.recurringStreams.id, id))
    .returning();
  if (!stream) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Turning "Spread across months" back off — undo the installments and
  // the real charge's exclusion, same cleanup DELETE runs, so the toggle
  // going off actually reverts everything instead of leaving stale
  // installments and a permanently-"Marked as annual" transaction behind.
  if (existing.amortizeMonthly && !stream.amortizeMonthly) {
    await undoAmortization(id);
  }

  // A new term on a stream that's still amortizing: this month's (and any
  // later) installment was posted at the old amount -- clear it so the
  // generation below re-posts it at averageAmount / new term.
  if (existing.amortizeMonthly && stream.amortizeMonthly && existing.amortizeMonths !== stream.amortizeMonths) {
    await resetCurrentInstallments(id, stream.lastDate);
  }

  // Only a manually-added bill or an amortizeMonthly stream gets synthetic
  // transactions — a plain auto-detected stream (this same PATCH also backs
  // its "Override" control) already gets real ones from Plaid, and pushing
  // its due date out further shouldn't fabricate a duplicate alongside them.
  let generated = 0;
  if (stream.isManual || stream.amortizeMonthly) {
    if (stream.amortizeMonthly) await excludeAmortizedRealCharges(userId);
    generated = await generateDueManualBillPayments(stream);
  }

  return NextResponse.json({ stream, generated });
}

// Any stream can be removed here, manually-added or auto-detected. A
// manually-added bill is hard deleted — nothing ever recreates it. An
// auto-detected stream is soft-deleted (dismissedAt) instead of dropping the
// row outright: detectRecurringForUser's upsert (lib/recurring.ts) targets
// (userId, merchantKey, accountId), so a hard delete would just let the next
// sync re-insert a fresh "active" row the moment the same charge posts
// again. Every stream listing filters dismissedAt IS NULL, so this is a
// permanent removal from the user's point of view.
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  let userId: string;
  try {
    userId = await requireUserId(req);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const [existing] = await db
    .select({
      id: schema.recurringStreams.id,
      userId: schema.recurringStreams.userId,
      isManual: schema.recurringStreams.isManual,
      amortizeMonthly: schema.recurringStreams.amortizeMonthly,
    })
    .from(schema.recurringStreams)
    .where(eq(schema.recurringStreams.id, id))
    .limit(1);
  if (!existing || existing.userId !== userId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (existing.amortizeMonthly) {
    await undoAmortization(id);
  }

  if (existing.isManual) {
    // Synthetic transactions a manual bill (not amortizing) posted stay
    // behind (transactions.recurringStreamId has no FK constraint, so it's
    // left pointing at a since-deleted row) — matches how deleting an income
    // schedule leaves its past paychecks in place; the user may still want
    // that spending history in Budgets/Transactions.
    await db.delete(schema.recurringStreams).where(eq(schema.recurringStreams.id, id));
  } else {
    // amortizeMonthly is reset alongside dismissedAt so this row can never
    // be picked up again by generateDueManualBillPaymentsForAllStreams's
    // isManual/amortizeMonthly filter now that it lives on indefinitely.
    await db
      .update(schema.recurringStreams)
      .set({ dismissedAt: new Date(), amortizeMonthly: false })
      .where(eq(schema.recurringStreams.id, id));
  }

  return NextResponse.json({ ok: true });
}
