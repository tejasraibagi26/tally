import { NextResponse } from "next/server";
import { db, schema } from "@/db";
import { eq } from "drizzle-orm";
import { requireUserId } from "@/lib/session";
import { syncTransactionsForItem } from "@/lib/plaidSync";
import { syncHoldingsForItem, syncInvestmentTransactionsForItem } from "@/lib/plaidInvestments";
import { syncLiabilitiesForItem } from "@/lib/plaidLiabilities";
import { runSyncStep, type SyncFailure } from "@/lib/syncSteps";

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

  const items = await db
    .select({ id: schema.plaidItems.id, institutionName: schema.plaidItems.institutionName })
    .from(schema.plaidItems)
    .where(eq(schema.plaidItems.userId, userId));

  const results = [];
  for (const item of items) {
    const failures: SyncFailure[] = [];
    const result = await runSyncStep("transactions", () => syncTransactionsForItem(item.id, "manual"), failures);
    await runSyncStep("holdings", () => syncHoldingsForItem(item.id, "manual"), failures);
    await runSyncStep("investments", () => syncInvestmentTransactionsForItem(item.id, "manual"), failures);
    await runSyncStep("liabilities", () => syncLiabilitiesForItem(item.id, "manual"), failures);
    results.push({
      itemId: item.id,
      institutionName: item.institutionName,
      ...(result ?? { inProgress: true }),
      failures,
    });
  }

  return NextResponse.json({ ok: true, results });
}
