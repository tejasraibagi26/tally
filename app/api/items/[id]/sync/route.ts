import { NextResponse } from "next/server";
import { db, schema } from "@/db";
import { eq } from "drizzle-orm";
import { requireUserId } from "@/lib/session";
import { syncTransactionsForItem } from "@/lib/plaidSync";
import { refreshAccountBalances } from "@/lib/plaidBalances";
import { syncHoldingsForItem, syncInvestmentTransactionsForItem } from "@/lib/plaidInvestments";
import { syncLiabilitiesForItem } from "@/lib/plaidLiabilities";

// Manual "Sync now": refreshes balances and runs a full /transactions/sync
// pass, plus holdings/investment-transactions/liabilities. The sync engines
// (lib/plaidSync.ts, lib/plaidInvestments.ts, lib/plaidLiabilities.ts) each
// own their own cursor/bookkeeping/item-status handling — this route just
// calls all of them for a live item.
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  let userId: string;
  try {
    userId = await requireUserId();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const [item] = await db
    .select({ id: schema.plaidItems.id, userId: schema.plaidItems.userId })
    .from(schema.plaidItems)
    .where(eq(schema.plaidItems.id, id))
    .limit(1);

  if (!item || item.userId !== userId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    await refreshAccountBalances(id, "manual");

    const result = await syncTransactionsForItem(id, "manual");

    // Best-effort: a brokerage/credit-only hiccup here shouldn't fail the
    // whole "Sync now" click when the transaction sync above succeeded.
    try {
      await syncHoldingsForItem(id, "manual");
      await syncInvestmentTransactionsForItem(id, "manual");
      await syncLiabilitiesForItem(id, "manual");
    } catch (err) {
      console.error(`Investments/liabilities sync failed for item ${id}`, err);
    }

    if (!result) {
      return NextResponse.json({ ok: true, inProgress: true });
    }
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("manual sync failed", err);
    return NextResponse.json({ error: "Sync failed" }, { status: 502 });
  }
}
