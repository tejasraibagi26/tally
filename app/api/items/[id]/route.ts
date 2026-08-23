import { NextResponse } from "next/server";
import { db, schema } from "@/db";
import { eq } from "drizzle-orm";
import { requireUserId } from "@/lib/session";
import { plaidClient, getAccessToken, plaidErrorCode } from "@/lib/plaid";
import { isMockPlaidItemId } from "@/lib/mock/isMock";

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  let userId: string;
  try {
    userId = await requireUserId();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const [item] = await db
    .select({ id: schema.plaidItems.id, userId: schema.plaidItems.userId, plaidItemId: schema.plaidItems.plaidItemId })
    .from(schema.plaidItems)
    .where(eq(schema.plaidItems.id, id))
    .limit(1);

  if (!item || item.userId !== userId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (!isMockPlaidItemId(item.plaidItemId)) {
    try {
      const accessToken = await getAccessToken(id);
      await plaidClient.itemRemove({ access_token: accessToken });
    } catch (err) {
      // Item may already be revoked/dead on Plaid's side — still proceed to
      // remove our local copy so the user isn't stuck with a zombie connection.
      const code = plaidErrorCode(err);
      console.error(`item/remove failed (${code ?? "unknown error"}), proceeding with local delete`);
    }
  }

  await db.delete(schema.plaidItems).where(eq(schema.plaidItems.id, id));

  return NextResponse.json({ ok: true });
}
