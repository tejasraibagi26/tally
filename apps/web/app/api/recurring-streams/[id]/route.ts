import { NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireUserId } from "@/lib/session";
import { generateDueManualBillPayments } from "@/lib/recurringBillGeneration";

const patchSchema = z.object({
  manualNextDueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
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

  const [stream] = await db
    .update(schema.recurringStreams)
    .set({ manualNextDueDate: parsed.data.manualNextDueDate })
    .where(eq(schema.recurringStreams.id, id))
    .returning();
  if (!stream) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Only a manually-added bill gets synthetic transactions — an
  // auto-detected stream (this same PATCH also backs its "Override" control)
  // already gets real ones from Plaid, and pushing its due date out further
  // shouldn't fabricate a duplicate alongside them.
  let generated = 0;
  if (stream.isManual) {
    generated = await generateDueManualBillPayments(stream);
  }

  return NextResponse.json({ stream, generated });
}

// Only a manually-added stream (AddBillForm's "+ Add a bill") can be removed
// here — an auto-detected one comes back on the next detectRecurringForUser
// run as long as its underlying transactions still exist, so deleting it
// would just be undone by the next sync.
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  let userId: string;
  try {
    userId = await requireUserId(req);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const [existing] = await db
    .select({ id: schema.recurringStreams.id, userId: schema.recurringStreams.userId, isManual: schema.recurringStreams.isManual })
    .from(schema.recurringStreams)
    .where(eq(schema.recurringStreams.id, id))
    .limit(1);
  if (!existing || existing.userId !== userId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!existing.isManual) {
    return NextResponse.json({ error: "Only manually-added bills can be removed" }, { status: 400 });
  }

  // Synthetic transactions generateDueManualBillPayments posted for this
  // stream stay behind (transactions.recurringStreamId has no FK constraint,
  // so it's left pointing at a since-deleted row) — matches how deleting an
  // income schedule leaves its past paychecks in place; the user may still
  // want that spending history in Budgets/Transactions.
  await db.delete(schema.recurringStreams).where(eq(schema.recurringStreams.id, id));

  return NextResponse.json({ ok: true });
}
