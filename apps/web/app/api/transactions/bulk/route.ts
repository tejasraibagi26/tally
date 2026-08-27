import { NextResponse } from "next/server";
import { z } from "zod";
import { and, eq, inArray } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireUserId } from "@/lib/session";

const bodySchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(500),
  action: z.discriminatedUnion("type", [
    z.object({ type: z.literal("setCategory"), categoryId: z.string().uuid() }),
    z.object({ type: z.literal("addTag"), tag: z.string().min(1).max(40) }),
    z.object({ type: z.literal("exclude"), value: z.boolean() }),
  ]),
});

export async function POST(req: Request) {
  let userId: string;
  try {
    userId = await requireUserId();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request", issues: parsed.error.issues }, { status: 400 });
  }
  const { ids, action } = parsed.data;

  // Ownership check first — a bulk action is only ever scoped to the
  // caller's own rows, regardless of which ids were posted.
  const owned = await db
    .select({ id: schema.transactions.id, tags: schema.transactions.tags })
    .from(schema.transactions)
    .where(and(inArray(schema.transactions.id, ids), eq(schema.transactions.userId, userId)));
  const ownedIds = owned.map((r) => r.id);
  if (ownedIds.length === 0) {
    return NextResponse.json({ ok: true, affected: 0 });
  }

  if (action.type === "setCategory") {
    await db
      .update(schema.transactions)
      .set({ categoryId: action.categoryId, categorySource: "manual" })
      .where(inArray(schema.transactions.id, ownedIds));
  } else if (action.type === "exclude") {
    await db.update(schema.transactions).set({ excludedFromBudget: action.value }).where(inArray(schema.transactions.id, ownedIds));
  } else if (action.type === "addTag") {
    for (const row of owned) {
      if (row.tags.includes(action.tag)) continue;
      await db
        .update(schema.transactions)
        .set({ tags: [...row.tags, action.tag] })
        .where(eq(schema.transactions.id, row.id));
    }
  }

  return NextResponse.json({ ok: true, affected: ownedIds.length });
}
