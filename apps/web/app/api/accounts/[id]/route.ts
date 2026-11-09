import { route } from "@/lib/log";
import { NextResponse } from "next/server";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireUserId } from "@/lib/session";
import { isValidKindOverride } from "@tally/core/accountKind";

// null clears the override and lets Plaid own the field again (see the
// creditLimitIsManual guards in lib/plaidBalances.ts and the exchange route).
// Both fields are optional so a nickname edit doesn't require re-sending
// creditLimit (and vice versa) -- each PATCH only touches what it's given.
// nickname: "" (or whitespace-only) is treated as null, clearing the
// override back to the real Plaid name -- see @tally/core/accountName.
const bodySchema = z
  .object({
    creditLimit: z.number().min(0).max(100_000_000).nullable().optional(),
    nickname: z.string().max(60).nullable().optional(),
    // The user's retag of the account's kind; null hands it back to Plaid.
    // Checked against the account's type below (@tally/core/accountKind).
    subtypeOverride: z.string().max(40).nullable().optional(),
  })
  .refine((v) => v.creditLimit !== undefined || v.nickname !== undefined || v.subtypeOverride !== undefined, "No fields to update");

async function PATCH_handler(req: Request, { params }: { params: Promise<{ id: string }> }) {
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
    .select({ id: schema.accounts.id, userId: schema.accounts.userId, type: schema.accounts.type, subtypeOverride: schema.accounts.subtypeOverride })
    .from(schema.accounts)
    .where(eq(schema.accounts.id, id))
    .limit(1);
  if (!account || account.userId !== userId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const updates: Partial<typeof schema.accounts.$inferInsert> = {};
  const response: { ok: true; creditLimit?: number | null; nickname?: string | null; subtypeOverride?: string | null } = { ok: true };
  if (parsed.data.creditLimit !== undefined) {
    const creditLimit = parsed.data.creditLimit != null ? Math.round(parsed.data.creditLimit * 100) : null;
    updates.creditLimit = creditLimit;
    updates.creditLimitIsManual = creditLimit != null;
    response.creditLimit = creditLimit;
  }
  if (parsed.data.nickname !== undefined) {
    const nickname = parsed.data.nickname?.trim() || null;
    updates.nickname = nickname;
    response.nickname = nickname;
  }
  if (parsed.data.subtypeOverride !== undefined) {
    const next = parsed.data.subtypeOverride;
    if (next !== null && !isValidKindOverride(account.type, next)) {
      return NextResponse.json({ error: "That kind doesn't fit this account" }, { status: 400 });
    }
    updates.subtypeOverride = next;
    // A new kind brings its own safe-to-spend default (checking counts,
    // savings doesn't); an earlier "counts as cash" choice was made against
    // the old kind, so it gives way.
    if (next !== account.subtypeOverride) updates.countsAsCash = null;
    response.subtypeOverride = next;
  }

  await db
    .update(schema.accounts)
    .set(updates)
    .where(and(eq(schema.accounts.id, id), eq(schema.accounts.userId, userId)));

  return NextResponse.json(response);
}

export const PATCH = route(PATCH_handler);
