import { NextResponse } from "next/server";
import { isAuthorizedCronRequest } from "@/lib/cronAuth";
import { activeItems } from "@/lib/activeItems";
import { refreshAccountBalances } from "@/lib/plaidBalances";
import { syncHoldingsForItem, syncInvestmentTransactionsForItem } from "@/lib/plaidInvestments";
import { syncLiabilitiesForItem } from "@/lib/plaidLiabilities";
import { computeAndStoreNetWorthSnapshot } from "@/lib/networth";
import { generateDuePaychecksForAllActiveSchedules } from "@/lib/incomeSchedule";
import { generateDueManualBillPaymentsForAllStreams } from "@/lib/recurringBillGeneration";
import { runSyncStep, type SyncFailure } from "@/lib/syncSteps";

export const maxDuration = 300;

// Nightly (vercel.json: 06:00 UTC, ≈2am Eastern): balance refresh, holdings
// snapshot, liabilities, and a net-worth snapshot for every item, plus any
// due manual paychecks (lib/incomeSchedule.ts) and manually-added bills
// (lib/recurringBillGeneration.ts) across every user. Budget rollover isn't
// a job — it's computed on read (lib/budgets.ts). Recurring re-detection
// isn't here either — it already runs after every transaction sync that
// finds something new (lib/plaidSync.ts).
export async function GET(req: Request) {
  if (!isAuthorizedCronRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const items = await activeItems();
  const today = new Date().toISOString().slice(0, 10);

  for (const item of items) {
    const failures: SyncFailure[] = [];
    await runSyncStep("balances", () => refreshAccountBalances(item.id, "cron"), failures);
    await runSyncStep("holdings", () => syncHoldingsForItem(item.id, "cron"), failures);
    await runSyncStep("investments", () => syncInvestmentTransactionsForItem(item.id, "cron"), failures);
    await runSyncStep("liabilities", () => syncLiabilitiesForItem(item.id, "cron"), failures);
    if (failures.length > 0) {
      console.error(`Cron nightly: item ${item.id} product failures`, failures);
    }
    try {
      await computeAndStoreNetWorthSnapshot(item.userId, today);
    } catch (err) {
      console.error(`Cron nightly: net-worth snapshot failed for user ${item.userId}`, err);
    }
  }

  let paychecksGenerated = 0;
  try {
    paychecksGenerated = await generateDuePaychecksForAllActiveSchedules(today);
  } catch (err) {
    console.error("Cron nightly: income schedule generation failed", err);
  }

  let billsGenerated = 0;
  try {
    billsGenerated = await generateDueManualBillPaymentsForAllStreams();
  } catch (err) {
    console.error("Cron nightly: manual bill generation failed", err);
  }

  return NextResponse.json({ ok: true, itemCount: items.length, paychecksGenerated, billsGenerated });
}
