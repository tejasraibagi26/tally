import { NextResponse } from "next/server";
import { db, schema } from "@/db";
import { eq } from "drizzle-orm";
import { requireUserId } from "@/lib/session";
import { disconnectItem } from "@/lib/reattach";
import { recordAudit } from "@/lib/audit";

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  let userId: string;
  try {
    userId = await requireUserId(req);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const [item] = await db
    .select({
      id: schema.plaidItems.id,
      userId: schema.plaidItems.userId,
      plaidItemId: schema.plaidItems.plaidItemId,
      institutionName: schema.plaidItems.institutionName,
      disconnectedAt: schema.plaidItems.disconnectedAt,
    })
    .from(schema.plaidItems)
    .where(eq(schema.plaidItems.id, id))
    .limit(1);

  if (!item || item.userId !== userId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (item.disconnectedAt) return NextResponse.json({ ok: true, alreadyDisconnected: true });

  // Disconnect, don't delete: access is removed at Plaid and syncing stops,
  // but the accounts and their transaction history stay, and reconnecting
  // the same bank later picks them back up (lib/reattach.ts). Wiping data
  // (app/api/account/wipe) is the way to delete it.
  const { accountCount } = await disconnectItem(id, userId);

  await recordAudit({
    userId,
    action: "plaid_item.disconnected",
    entity: "plaid_items",
    entityId: id,
    before: { institutionName: item.institutionName, accountCount },
  });

  return NextResponse.json({ ok: true });
}
