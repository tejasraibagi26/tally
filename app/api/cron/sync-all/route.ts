import { NextResponse } from "next/server";
import { isAuthorizedCronRequest } from "@/lib/cronAuth";
import { activeItemIds } from "@/lib/activeItems";
import { syncTransactionsForItem } from "@/lib/plaidSync";

export const maxDuration = 300;

// Twice-daily cron safety net (vercel.json: 10:00 & 22:00 UTC, ≈6am/6pm
// Eastern — Vercel Cron always runs in UTC, no per-project timezone, so this
// drifts an hour across the DST boundary) — re-syncs transactions for every
// item in case a webhook was missed. Runs items sequentially so one
// slow/broken item can't starve the rest of their time budget.
export async function GET(req: Request) {
  if (!isAuthorizedCronRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const itemIds = await activeItemIds();
  let failed = 0;
  for (const itemId of itemIds) {
    try {
      await syncTransactionsForItem(itemId, "cron");
    } catch (err) {
      failed++;
      console.error(`Cron sync-all: transactions sync failed for item ${itemId}`, err);
    }
  }

  return NextResponse.json({ ok: true, itemCount: itemIds.length, failed });
}
