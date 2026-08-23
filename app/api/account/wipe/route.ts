import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireUserId } from "@/lib/session";
import { plaidClient, getAccessToken, plaidErrorCode } from "@/lib/plaid";
import { isMockPlaidItemId } from "@/lib/mock/isMock";

const bodySchema = z.object({ currentPassword: z.string().min(1) });

// Disconnects every institution and deletes all local financial data for
// the current user (accounts/transactions/holdings/etc. cascade off
// plaid_items). Does NOT delete the login itself — that's a different,
// even more destructive action this app doesn't expose.
export async function POST(req: Request) {
  let userId: string;
  try {
    userId = await requireUserId();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const [user] = await db.select().from(schema.users).where(eq(schema.users.id, userId)).limit(1);
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const valid = await bcrypt.compare(parsed.data.currentPassword, user.passwordHash);
  if (!valid) {
    return NextResponse.json({ error: "Current password is incorrect" }, { status: 403 });
  }

  const items = await db
    .select({ id: schema.plaidItems.id, plaidItemId: schema.plaidItems.plaidItemId })
    .from(schema.plaidItems)
    .where(eq(schema.plaidItems.userId, userId));

  for (const item of items) {
    if (isMockPlaidItemId(item.plaidItemId)) continue;
    try {
      const accessToken = await getAccessToken(item.id);
      await plaidClient.itemRemove({ access_token: accessToken });
    } catch (err) {
      const code = plaidErrorCode(err);
      console.error(`item/remove failed during wipe for item ${item.id} (${code ?? "unknown error"}), continuing`);
    }
  }

  await db.delete(schema.plaidItems).where(eq(schema.plaidItems.userId, userId));
  await db.delete(schema.netWorthSnapshots).where(eq(schema.netWorthSnapshots.userId, userId));

  return NextResponse.json({ ok: true, itemsRemoved: items.length });
}
