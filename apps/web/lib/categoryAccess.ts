import { and, inArray, isNull, eq, or } from "drizzle-orm";
import { db, schema } from "@/db";

/** True when every id is a category this user may point at: a system one
 * (userId null) or one of their own. Routes that take a category id from
 * the request call this before writing it anywhere, so a user can't attach
 * someone else's private category (and read its name back through a join).
 * null/undefined entries mean "no category" and always pass. */
export async function categoriesUsableBy(userId: string, ids: (string | null | undefined)[]): Promise<boolean> {
  const wanted = [...new Set(ids.filter((id): id is string => typeof id === "string"))];
  if (wanted.length === 0) return true;
  const rows = await db
    .select({ id: schema.categories.id })
    .from(schema.categories)
    .where(and(inArray(schema.categories.id, wanted), or(isNull(schema.categories.userId), eq(schema.categories.userId, userId))));
  return rows.length === wanted.length;
}

export const unknownCategoryBody = { error: "Unknown category" } as const;
