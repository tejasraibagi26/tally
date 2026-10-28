import { NextResponse } from "next/server";
import { z } from "zod";
import { and, eq, inArray } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireUserId } from "@/lib/session";

const bodySchema = z.object({
  // $0 to $100,000, in cents
  cushion: z.number().int().min(0).max(10_000_000).optional(),
  // Whether each account counts as spending money; null goes back to its type's default.
  accounts: z.record(z.string().uuid(), z.boolean().nullable()).optional(),
  // A card's due day when the bank reports none: 1-31, 0 = the last day; null clears it.
  dueDays: z.record(z.string().uuid(), z.number().int().min(0).max(31).nullable()).optional(),
});

export async function PUT(req: Request) {
  let userId: string;
  try {
    userId = await requireUserId(req);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request", issues: parsed.error.issues }, { status: 400 });
  const { cushion, accounts = {}, dueDays = {} } = parsed.data;

  const ids = [...new Set([...Object.keys(accounts), ...Object.keys(dueDays)])];
  if (ids.length > 0) {
    const owned = await db
      .select({ id: schema.accounts.id })
      .from(schema.accounts)
      .where(and(eq(schema.accounts.userId, userId), inArray(schema.accounts.id, ids)));
    if (owned.length !== ids.length) return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (cushion !== undefined) await db.update(schema.users).set({ safeToSpendCushion: cushion }).where(eq(schema.users.id, userId));
  for (const [id, counts] of Object.entries(accounts)) {
    await db.update(schema.accounts).set({ countsAsCash: counts }).where(eq(schema.accounts.id, id));
  }
  for (const [id, day] of Object.entries(dueDays)) {
    await db.update(schema.accounts).set({ paymentDueDay: day }).where(eq(schema.accounts.id, id));
  }
  return NextResponse.json({ ok: true });
}
