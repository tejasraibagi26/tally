import { route } from "@/lib/log";
import { NextResponse } from "next/server";
import { z } from "zod";
import { eq, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireUserId } from "@/lib/session";
import { categoriesUsableBy, unknownCategoryBody } from "@/lib/categoryAccess";
import { userCategories } from "@/lib/userCategories";

const patchSchema = z.object({
  name: z.string().min(1).max(80).optional(),
  parentId: z.string().uuid().nullable().optional(),
  colorSlot: z.number().int().min(1).max(8).optional(),
  icon: z.string().max(40).nullable().optional(),
});

// §7.1: users can rename/recolor/reparent any category they see. Their own
// category is edited in place; a system one (seeded from Plaid's taxonomy,
// shared by every user) never is -- the edit becomes this user's override
// (category_overrides, read back through lib/userCategories.ts), so nobody
// else sees it and the seed script can keep the shared row in sync.
async function PATCH_handler(req: Request, { params }: { params: Promise<{ id: string }> }) {
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
  if (parsed.data.parentId === id) {
    return NextResponse.json({ error: "A category can't be its own parent" }, { status: 400 });
  }
  if (!(await categoriesUsableBy(userId, [parsed.data.parentId]))) {
    return NextResponse.json(unknownCategoryBody, { status: 400 });
  }

  if (category.userId === userId) {
    await db.update(schema.categories).set(parsed.data).where(eq(schema.categories.id, id));
  } else {
    // Start from what this user sees now (their earlier override, or the
    // system row), so the snapshot carries every field, not just this edit.
    const uc = userCategories(userId);
    const [current] = await db.select().from(uc).where(eq(uc.id, id)).limit(1);
    if (!current) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const next = {
      name: parsed.data.name ?? current.name,
      colorSlot: parsed.data.colorSlot ?? current.colorSlot,
      icon: parsed.data.icon !== undefined ? parsed.data.icon : current.icon,
      parentId: parsed.data.parentId !== undefined ? parsed.data.parentId : current.parentId,
      updatedAt: new Date(),
    };
    await db
      .insert(schema.categoryOverrides)
      .values({ userId, categoryId: id, ...next })
      .onConflictDoUpdate({ target: [schema.categoryOverrides.userId, schema.categoryOverrides.categoryId], set: next });
  }

  const uc = userCategories(userId);
  const [updated] = await db.select().from(uc).where(eq(uc.id, id)).limit(1);
  return NextResponse.json({ category: updated });
}

// Only a user-owned, unused category can be deleted outright — deleting a
// system category would break every future sync's PFC->category lookup for
// that slug, and deleting a used category would orphan transactions/budgets.
// Merging into another category first (not yet a separate endpoint) is the
// path for a category that's already in use.
async function DELETE_handler(req: Request, { params }: { params: Promise<{ id: string }> }) {
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
  // Children as this user sees them -- a system category they moved under
  // this one (an override) counts as much as one they created there.
  const uc = userCategories(userId);
  const childCountRows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(uc)
    .where(eq(uc.parentId, id));

  const txCount = txCountRows[0]?.count ?? 0;
  const budgetCount = budgetCountRows[0]?.count ?? 0;
  const childCount = childCountRows[0]?.count ?? 0;

  if (txCount > 0 || budgetCount > 0 || childCount > 0) {
    return NextResponse.json({ error: "Category is in use. Reassign or merge it first" }, { status: 409 });
  }

  await db.delete(schema.categories).where(eq(schema.categories.id, id));
  return NextResponse.json({ ok: true });
}

export const PATCH = route(PATCH_handler);
export const DELETE = route(DELETE_handler);
