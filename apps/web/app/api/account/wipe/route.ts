import { log } from "@switchyard/logger";
import { route } from "@/lib/log";
import { NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireUserId } from "@/lib/session";
import { verifyCurrentPassword } from "@/lib/authenticateCredentials";
import { RATE_LIMITED_MESSAGE } from "@/lib/rateLimit";
import { plaidClient, getAccessToken, plaidErrorCode } from "@/lib/plaid";
import { isMockPlaidItemId } from "@/lib/mock/isMock";

const bodySchema = z.object({ currentPassword: z.string().min(1) });

// Disconnects every institution and deletes all local financial data for
// the current user (accounts/transactions/holdings/etc. cascade off
// plaid_items). Does NOT delete the login itself — that's a different,
// even more destructive action this app doesn't expose.
async function POST_handler(req: Request) {
  let userId: string;
  try {
    userId = await requireUserId(req);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const [user] = await db.select().from(schema.users).where(eq(schema.users.id, userId)).limit(1);
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const valid = await verifyCurrentPassword(userId, user.passwordHash, parsed.data.currentPassword, req);
  if (valid === "rate_limited") {
    return NextResponse.json({ error: RATE_LIMITED_MESSAGE }, { status: 429 });
  }
  if (!valid) {
    return NextResponse.json({ error: "Current password is incorrect" }, { status: 403 });
  }

  const items = await db
    .select({ id: schema.plaidItems.id, plaidItemId: schema.plaidItems.plaidItemId, disconnectedAt: schema.plaidItems.disconnectedAt })
    .from(schema.plaidItems)
    .where(eq(schema.plaidItems.userId, userId));

  for (const item of items) {
    // A disconnected bank's access was already removed at Plaid.
    if (isMockPlaidItemId(item.plaidItemId) || item.disconnectedAt) continue;
    try {
      const accessToken = await getAccessToken(item.id);
      await plaidClient.itemRemove({ access_token: accessToken });
    } catch (err) {
      const code = plaidErrorCode(err);
      log.error(`item/remove failed during wipe for item ${item.id} (${code ?? "unknown error"}), continuing`);
    }
  }

  // recurring_streams.account_id has no ON DELETE cascade (a stream can
  // reference a since-deleted account by design), so it blocks the
  // plaid_items delete (which cascades to accounts) unless removed first.
  await db.delete(schema.recurringStreams).where(eq(schema.recurringStreams.userId, userId));
  await db.delete(schema.plaidItems).where(eq(schema.plaidItems.userId, userId));
  await db.delete(schema.netWorthSnapshots).where(eq(schema.netWorthSnapshots.userId, userId));

  return NextResponse.json({ ok: true, itemsRemoved: items.length });
}

export const POST = route(POST_handler);
