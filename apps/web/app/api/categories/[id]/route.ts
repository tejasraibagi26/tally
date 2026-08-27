import { NextResponse } from "next/server";
import { z } from "zod";
import { and, eq, or, isNull, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireUserId } from "@/lib/session";

const patchSchema = z.object({
  name: z.string().min(1).max(80).optional(),
  parentId: z.string().uuid().nullable().optional(),
  colorSlot: z.number().int().min(1).max(8).optional(),
  icon: z.string().max(40).nullable().optional(),
});

// §7.1: users can rename/recolor/reparent any category, including a system
// one seeded from Plaid's taxonomy — there's only one owner of this
// instance's data, so there's no need to fork a system category into a
// per-user override first.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  let userId: string;
  try {
    userId = await requireUserId(req);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const [category] = await db
    .select({ id: schema.categories.id, userId: schema.categories.userId })
    .from(schema.categories)
    .where(eq(schema.categories.id, id))
    .limit(1);
  if (!category || (category.userId !== null && category.userId !== userId)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const parsed = patchSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request", issues: parsed.error.issues }, { status: 400 });
  }
  if (Object.keys(parsed.data).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  const [updated] = await db.update(schema.categories).set(parsed.data).where(eq(schema.categories.id, id)).returning();
  return NextResponse.json({ category: updated });
}

// Only a user-owned, unused category can be deleted outright — deleting a
// system category would break every future sync's PFC->category lookup for
// that slug, and deleting a used category would orphan transactions/budgets.
// Merging into another category first (not yet a separate endpoint) is the
// path for a category that's already in use.
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  let userId: string;
  try {
    userId = await requireUserId(req);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const [category] = await db
    .select({ id: schema.categories.id, userId: schema.categories.userId })
    .from(schema.categories)
    .where(eq(schema.categories.id, id))
    .limit(1);
  if (!category || category.userId !== userId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const txCountRows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.transactions)
    .where(eq(schema.transactions.categoryId, id));
  const budgetCountRows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.budgets)
    .where(eq(schema.budgets.categoryId, id));
  const childCountRows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.categories)
    .where(and(eq(schema.categories.parentId, id), or(isNull(schema.categories.userId), eq(schema.categories.userId, userId))));

  const txCount = txCountRows[0]?.count ?? 0;
  const budgetCount = budgetCountRows[0]?.count ?? 0;
  const childCount = childCountRows[0]?.count ?? 0;

  if (txCount > 0 || budgetCount > 0 || childCount > 0) {
    return NextResponse.json({ error: "Category is in use — reassign or merge it first" }, { status: 409 });
  }

  await db.delete(schema.categories).where(eq(schema.categories.id, id));
  return NextResponse.json({ ok: true });
}
