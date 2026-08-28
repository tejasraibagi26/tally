import { NextResponse } from "next/server";
import { db, schema } from "@/db";
import { eq } from "drizzle-orm";
import { requireUserId } from "@/lib/session";
import { refreshAccountBalances } from "@/lib/plaidBalances";
import { recordAudit } from "@/lib/audit";
import { plaidErrorCode } from "@/lib/plaid";

// Lighter-weight than "Sync now" (which also pulls transactions/holdings/
// investments/liabilities) — just the balances, for the 3-dot menu's
// "Refresh balances" action.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  let userId: string;
  try {
    userId = await requireUserId(req);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const [item] = await db
    .select({ id: schema.plaidItems.id, userId: schema.plaidItems.userId, institutionName: schema.plaidItems.institutionName })
    .from(schema.plaidItems)
    .where(eq(schema.plaidItems.id, id))
    .limit(1);

  if (!item || item.userId !== userId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    await refreshAccountBalances(id, "manual");
    await recordAudit({
      userId,
      action: "plaid_item.balances_refreshed",
      entity: "plaid_items",
      entityId: id,
      after: { institutionName: item.institutionName },
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    // err's own .response is truncated to "[Object]" by console.error's
    // default inspection depth, hiding Plaid's actual error_code/message --
    // pull it out explicitly (refreshAccountBalances also logs this now,
    // but this route's own catch never did).
    console.error(`Balance refresh failed for item ${id}`, { code: plaidErrorCode(err), message: err instanceof Error ? err.message : err });
    return NextResponse.json({ error: "Refresh failed" }, { status: 502 });
  }
}
