import { NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireUserId } from "@/lib/session";
import { generateDuePaychecks } from "@/lib/incomeSchedule";

const anchorSchema = z.number().int().min(0).max(31);
const patchSchema = z.object({
  categoryId: z.string().uuid().nullable().optional(),
  label: z.string().min(1).max(80).optional(),
  amount: z.number().int().positive().optional(),
  dayAnchors: z.array(anchorSchema).min(1).max(2).optional(),
  active: z.boolean().optional(),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  let userId: string;
  try {
    userId = await requireUserId();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const [existing] = await db
    .select({ id: schema.incomeSchedules.id, userId: schema.incomeSchedules.userId })
    .from(schema.incomeSchedules)
    .where(eq(schema.incomeSchedules.id, id))
    .limit(1);
  if (!existing || existing.userId !== userId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const parsed = patchSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request", issues: parsed.error.issues }, { status: 400 });
  }
  if (Object.keys(parsed.data).length === 0) {
    return NextResponse.json({ error: "No changes" }, { status: 400 });
  }

  const [schedule] = await db
    .update(schema.incomeSchedules)
    .set(parsed.data)
    .where(eq(schema.incomeSchedules.id, id))
    .returning();
  if (!schedule) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let generated = 0;
  if (schedule.active) {
    const today = new Date().toISOString().slice(0, 10);
    generated = await generateDuePaychecks(schedule, today);
  }

  return NextResponse.json({ schedule, generated });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  let userId: string;
  try {
    userId = await requireUserId();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const [existing] = await db
    .select({ id: schema.incomeSchedules.id, userId: schema.incomeSchedules.userId })
    .from(schema.incomeSchedules)
    .where(eq(schema.incomeSchedules.id, id))
    .limit(1);
  if (!existing || existing.userId !== userId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Past paychecks this schedule already generated are real transactions the
  // user may still want (they can delete them individually) — only the
  // schedule itself goes away; onDelete: "set null" (schema.ts) detaches them.
  await db.delete(schema.incomeSchedules).where(eq(schema.incomeSchedules.id, id));

  return NextResponse.json({ ok: true });
}
