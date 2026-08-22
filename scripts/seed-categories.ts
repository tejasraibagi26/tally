import "dotenv/config";
import { and, eq, isNull } from "drizzle-orm";
import { db, schema } from "../db";
import { buildCategoryTaxonomy } from "../lib/categoryTaxonomy";

/**
 * Seeds system categories (user_id = null) from Plaid's PFC taxonomy
 * (WORK.md §7.1). Idempotent — matches existing rows by slug rather than
 * inserting blindly, so re-running after editing lib/categoryTaxonomy.ts
 * only adds what's missing and never touches a category a user has already
 * renamed (name/icon/colorSlot are seeded once, on first insert, only).
 */
async function main() {
  const taxonomy = buildCategoryTaxonomy();
  let created = 0;
  let sortOrder = 0;

  for (const parent of taxonomy) {
    sortOrder += 10;
    const parentId = await findOrCreate({
      slug: parent.slug,
      name: parent.name,
      kind: parent.kind,
      colorSlot: parent.colorSlot,
      parentId: null,
      sortOrder,
    });
    if (parentId.inserted) created++;

    let childSortOrder = 0;
    for (const child of parent.children) {
      childSortOrder += 10;
      const result = await findOrCreate({
        slug: child.slug,
        name: child.name,
        kind: child.kind,
        colorSlot: parent.colorSlot,
        parentId: parentId.id,
        sortOrder: childSortOrder,
      });
      if (result.inserted) created++;
    }
  }

  console.log(`Category seed complete: ${created} created, ${taxonomy.length + taxonomy.flatMap((p) => p.children).length - created} already present.`);
  process.exit(0);
}

async function findOrCreate(row: {
  slug: string;
  name: string;
  kind: "income" | "expense" | "transfer" | "ignore";
  colorSlot: number;
  parentId: string | null;
  sortOrder: number;
}): Promise<{ id: string; inserted: boolean }> {
  const [existing] = await db
    .select({ id: schema.categories.id })
    .from(schema.categories)
    .where(and(isNull(schema.categories.userId), eq(schema.categories.slug, row.slug)))
    .limit(1);
  if (existing) return { id: existing.id, inserted: false };

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
  return { id: created.id, inserted: true };
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
