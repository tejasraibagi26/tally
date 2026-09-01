import { NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireUserId } from "@/lib/session";
import { excludeAmortizedRealCharges, generateDueManualBillPayments } from "@/lib/recurringBillGeneration";

const patchSchema = z.object({
  manualNextDueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  // Only meaningful for a frequency = "annual" stream — see schema.ts's
  // recurringStreams.amortizeMonthly doc comment. Backs both the Subscriptions
  // page's "spread across months" toggle and confirming a 2-occurrence
  // annual candidate detectRecurringForUser surfaced on its own.
  amortizeMonthly: z.boolean().optional(),
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
    .select({ id: schema.recurringStreams.id, userId: schema.recurringStreams.userId })
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

// Any stream can be removed here, manually-added or auto-detected — note
// for the latter that it comes back on the next detectRecurringForUser run
// as long as its underlying transactions still exist and still cluster the
// same way, so this is "hide it for now," not a permanent dismissal.
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  let userId: string;
  try {
    userId = await requireUserId(req);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const [existing] = await db
    .select({ id: schema.recurringStreams.id, userId: schema.recurringStreams.userId })
    .from(schema.recurringStreams)
    .where(eq(schema.recurringStreams.id, id))
    .limit(1);
  if (!existing || existing.userId !== userId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Synthetic transactions generateDueManualBillPayments posted for this
  // stream stay behind (transactions.recurringStreamId has no FK constraint,
  // so it's left pointing at a since-deleted row) — matches how deleting an
  // income schedule leaves its past paychecks in place; the user may still
  // want that spending history in Budgets/Transactions.
  await db.delete(schema.recurringStreams).where(eq(schema.recurringStreams.id, id));

  return NextResponse.json({ ok: true });
}
