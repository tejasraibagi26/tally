import { and, asc, eq, isNull, or, sql } from "drizzle-orm";
import { db, schema } from "@/db";

/**
 * The categories one user sees, as a subquery that reads like the
 * categories table: system rows (user_id null) with that user's own
 * name/colour/icon/parent laid over them from category_overrides, plus the
 * categories they created. Anything that shows a category's name or colour,
 * or groups by parent, joins this instead of schema.categories -- so one
 * user's renames never reach another. Reads that only need id/kind/slug
 * (never overridden) can keep using the table.
 *
 *   const cats = userCategories(userId);
 *   db.select({ name: cats.name }).from(schema.transactions)
 *     .leftJoin(cats, eq(schema.transactions.categoryId, cats.id))
 */
export function userCategories(userId: string) {
  const c = schema.categories;
  const o = schema.categoryOverrides;
  // An override is a full snapshot of the editable fields, so "has one"
  // picks every field from it -- including a cleared icon or a move to the
  // top level, which a coalesce would lose. The computed columns get uc_
  // aliases because drizzle refers to them unqualified from the outer
  // query, where a bare "name" would clash with transactions.name.
  const overridden = sql`${o.categoryId} is not null`;
  return db
    .select({
      id: c.id,
      userId: c.userId,
      slug: c.slug,
      kind: c.kind,
      sortOrder: c.sortOrder,
      name: sql<string>`case when ${overridden} then ${o.name} else ${c.name} end`.as("uc_name"),
      colorSlot: sql<number>`case when ${overridden} then ${o.colorSlot} else ${c.colorSlot} end`.as("uc_color_slot"),
      icon: sql<string | null>`case when ${overridden} then ${o.icon} else ${c.icon} end`.as("uc_icon"),
      parentId: sql<string | null>`case when ${overridden} then ${o.parentId} else ${c.parentId} end`.as("uc_parent_id"),
    })
    .from(c)
    .leftJoin(o, and(eq(o.categoryId, c.id), eq(o.userId, userId)))
    .where(or(isNull(c.userId), eq(c.userId, userId)))
    .as("user_categories");
}

export type UserCategory = {
  id: string;
  userId: string | null;
  slug: string;
  kind: "income" | "expense" | "transfer" | "ignore";
  sortOrder: number;
  name: string;
  colorSlot: number;
  icon: string | null;
  parentId: string | null;
};

/** Every category this user sees, overrides applied -- the replacement for
 * `db.query.categories.findMany({ where: userId is null or = userId })`.
 * Sorted by (overridden) name, or by the taxonomy's order then name. */
export async function listUserCategories(userId: string, order: "name" | "sortOrder" = "name"): Promise<UserCategory[]> {
  const cats = userCategories(userId);
  return db
    .select()
    .from(cats)
    .orderBy(...(order === "name" ? [asc(cats.name)] : [asc(cats.sortOrder), asc(cats.name)]));
}
