import { NextResponse } from "next/server";
import { db, schema } from "@/db";
import { eq } from "drizzle-orm";
import { requireUserId } from "@/lib/session";
import { syncTransactionsForItem } from "@/lib/plaidSync";
import { refreshAccountBalances } from "@/lib/plaidBalances";
import { syncHoldingsForItem, syncInvestmentTransactionsForItem } from "@/lib/plaidInvestments";
import { syncLiabilitiesForItem } from "@/lib/plaidLiabilities";
import { runSyncStep, type SyncFailure } from "@/lib/syncSteps";

// Manual "Sync now": refreshes balances and runs a full /transactions/sync
// pass, plus holdings/investment-transactions/liabilities. The sync engines
// (lib/plaidSync.ts, lib/plaidInvestments.ts, lib/plaidLiabilities.ts) each
// own their own cursor/bookkeeping/item-status handling — this route just
// calls all of them for a live item. Each step runs independently
// (runSyncStep) so one down product doesn't prevent the others from running,
// and `failures` reports back what didn't come through.
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  let userId: string;
  try {
    userId = await requireUserId();
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

  const failures: SyncFailure[] = [];
  await runSyncStep("balances", () => refreshAccountBalances(id, "manual"), failures);
  const result = await runSyncStep("transactions", () => syncTransactionsForItem(id, "manual"), failures);
  await runSyncStep("holdings", () => syncHoldingsForItem(id, "manual"), failures);
  await runSyncStep("investments", () => syncInvestmentTransactionsForItem(id, "manual"), failures);
  await runSyncStep("liabilities", () => syncLiabilitiesForItem(id, "manual"), failures);

  return NextResponse.json({ ok: true, ...(result ?? { inProgress: true }), institutionName: item.institutionName, failures });
}
