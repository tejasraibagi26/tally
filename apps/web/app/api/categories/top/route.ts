import { route } from "@/lib/log";
import { NextResponse } from "next/server";
import { and, desc, eq, gte, isNotNull, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireUserId } from "@/lib/session";
import { todayFor } from "@/lib/userTimezone";

const LIMIT = 5;
const DAYS = 90;

/**
 * The user's most-used categories of one kind over the last 90 days (by
 * how many transactions carry them), most-used first -- the quick-pick
 * chips on mobile's Add transaction sheet. Only ids: the client already has
 * every category from GET /api/categories, and tops up with its own
 * top-level categories when there's less history than LIMIT.
 */
async function GET_handler(req: Request) {
  let userId: string;
  try {
    userId = await requireUserId(req);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const kind = new URL(req.url).searchParams.get("kind") === "income" ? "income" : "expense";
  // The window starts from the user's own today, never the server's UTC date.
  const today = await todayFor(userId);

  const rows = await db
    .select({ categoryId: schema.transactions.categoryId, uses: sql<number>`count(*)::int` })
    .from(schema.transactions)
    .innerJoin(schema.categories, eq(schema.transactions.categoryId, schema.categories.id))
    .where(
      and(
        eq(schema.transactions.userId, userId),
        eq(schema.transactions.isTransfer, false),
        isNotNull(schema.transactions.categoryId),
        eq(schema.categories.kind, kind),
        gte(schema.transactions.postedDate, sql`(${today}::date - ${DAYS}::int)`),
      ),
    )
    .groupBy(schema.transactions.categoryId)
    .orderBy(desc(sql`count(*)`))
    .limit(LIMIT);

  return NextResponse.json({ categoryIds: rows.map((r) => r.categoryId).filter((id): id is string => !!id) });
}

export const GET = route(GET_handler);
