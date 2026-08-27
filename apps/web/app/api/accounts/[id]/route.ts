import { NextResponse } from "next/server";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireUserId } from "@/lib/session";

// null clears the override and lets Plaid own the field again (see the
// creditLimitIsManual guards in lib/plaidBalances.ts and the exchange route).
const bodySchema = z.object({ creditLimit: z.number().min(0).max(100_000_000).nullable() });

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  let userId: string;
  try {
    userId = await requireUserId(req);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const { id } = await params;
  const [account] = await db
    .select({ id: schema.accounts.id, userId: schema.accounts.userId })
    .from(schema.accounts)
    .where(eq(schema.accounts.id, id))
    .limit(1);
  if (!account || account.userId !== userId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const creditLimit = parsed.data.creditLimit != null ? Math.round(parsed.data.creditLimit * 100) : null;
  await db
    .update(schema.accounts)
    .set({ creditLimit, creditLimitIsManual: creditLimit != null })
    .where(and(eq(schema.accounts.id, id), eq(schema.accounts.userId, userId)));

  return NextResponse.json({ ok: true, creditLimit });
}
