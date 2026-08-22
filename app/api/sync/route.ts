import { NextResponse } from "next/server";
import { db, schema } from "@/db";
import { eq } from "drizzle-orm";
import { requireUserId } from "@/lib/session";
import { syncTransactionsForItem } from "@/lib/plaidSync";
import { syncHoldingsForItem, syncInvestmentTransactionsForItem } from "@/lib/plaidInvestments";
import { syncLiabilitiesForItem } from "@/lib/plaidLiabilities";

// Convenience for the Transactions screen's "Sync now" — syncs every item
// the user owns. Sequential per item (each item already serializes its own
// pages internally); fine at this account count, revisit if that changes.
export async function POST() {
  let userId: string;
  try {
    userId = await requireUserId();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const items = await db.select({ id: schema.plaidItems.id }).from(schema.plaidItems).where(eq(schema.plaidItems.userId, userId));

  const results = [];
  for (const item of items) {
    try {
      const result = await syncTransactionsForItem(item.id, "manual");
      results.push({ itemId: item.id, ...(result ?? { inProgress: true }) });
    } catch (err) {
      results.push({ itemId: item.id, error: err instanceof Error ? err.message : "unknown error" });
    }

    try {
      await syncHoldingsForItem(item.id, "manual");
      await syncInvestmentTransactionsForItem(item.id, "manual");
      await syncLiabilitiesForItem(item.id, "manual");
    } catch (err) {
      console.error(`Investments/liabilities sync failed for item ${item.id}`, err);
    }
  }

  return NextResponse.json({ ok: true, results });
}
