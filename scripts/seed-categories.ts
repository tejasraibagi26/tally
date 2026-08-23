import "dotenv/config";
import { and, eq, isNull } from "drizzle-orm";
import { db, schema } from "../db";
import { buildCategoryTaxonomy } from "../lib/categoryTaxonomy";

/**
 * Seeds system categories (user_id = null) from Plaid's PFC taxonomy
 * (WORK.md §7.1). Idempotent and repairing — matches existing rows by slug,
 * and keeps name/kind/colorSlot/sortOrder in sync with lib/categoryTaxonomy.ts
 * on every run. Safe to sync unconditionally because system categories are
 * taxonomy-owned, not user-owned: a user's own categories live under their
 * own userId (POST /api/categories) and are never touched by this script,
 * which only ever queries userId IS NULL.
 */
async function main() {
  const taxonomy = buildCategoryTaxonomy();
  let created = 0;
  let updated = 0;
  let sortOrder = 0;

  for (const parent of taxonomy) {
    sortOrder += 10;
    const parentResult = await findOrCreate({
      slug: parent.slug,
      name: parent.name,
      kind: parent.kind,
      colorSlot: parent.colorSlot,
      parentId: null,
      sortOrder,
    });
    if (parentResult.inserted) created++;
    else if (parentResult.updated) updated++;

    let childSortOrder = 0;
    for (const child of parent.children) {
      childSortOrder += 10;
      const result = await findOrCreate({
        slug: child.slug,
        name: child.name,
        kind: child.kind,
        colorSlot: parent.colorSlot,
        parentId: parentResult.id,
        sortOrder: childSortOrder,
      });
      if (result.inserted) created++;
      else if (result.updated) updated++;
    }
  }

  const total = taxonomy.length + taxonomy.flatMap((p) => p.children).length;
  console.log(`Category seed complete: ${created} created, ${updated} updated, ${total - created - updated} unchanged.`);
  process.exit(0);
}

async function findOrCreate(row: {
  slug: string;
  name: string;
  kind: "income" | "expense" | "transfer" | "ignore";
  colorSlot: number;
  parentId: string | null;
  sortOrder: number;
}): Promise<{ id: string; inserted: boolean; updated: boolean }> {
  const [existing] = await db
    .select({ id: schema.categories.id, name: schema.categories.name, kind: schema.categories.kind, colorSlot: schema.categories.colorSlot, sortOrder: schema.categories.sortOrder, parentId: schema.categories.parentId })
    .from(schema.categories)
    .where(and(isNull(schema.categories.userId), eq(schema.categories.slug, row.slug)))
    .limit(1);

  if (existing) {
    const needsUpdate =
      existing.name !== row.name ||
      existing.kind !== row.kind ||
      existing.colorSlot !== row.colorSlot ||
      existing.sortOrder !== row.sortOrder ||
      existing.parentId !== row.parentId;
    if (needsUpdate) {
      await db
        .update(schema.categories)
        .set({ name: row.name, kind: row.kind, colorSlot: row.colorSlot, sortOrder: row.sortOrder, parentId: row.parentId })
        .where(eq(schema.categories.id, existing.id));
    }
    return { id: existing.id, inserted: false, updated: needsUpdate };
  }

  const [created] = await db
    .insert(schema.categories)
    .values({
      userId: null,
      parentId: row.parentId,
      name: row.name,
      slug: row.slug,
      kind: row.kind,
      colorSlot: row.colorSlot,
      sortOrder: row.sortOrder,
    })
    .returning({ id: schema.categories.id });
  if (!created) throw new Error(`Failed to create category ${row.slug}`);
  return { id: created.id, inserted: true, updated: false };
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
