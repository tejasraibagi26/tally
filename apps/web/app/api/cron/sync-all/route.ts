import { log } from "@switchyard/logger";
import { route } from "@/lib/log";
import { NextResponse } from "next/server";
import { isAuthorizedCronRequest, isAuthorizedQStashRequest } from "@/lib/cronAuth";
import { activeItemIds } from "@/lib/activeItems";
import { syncTransactionsForItem } from "@/lib/plaidSync";

export const maxDuration = 300;

async function runSyncAll(): Promise<{ itemCount: number; failed: number }> {
  const itemIds = await activeItemIds();
  let failed = 0;
  for (const itemId of itemIds) {
    try {
      await syncTransactionsForItem(itemId, "cron");
    } catch (err) {
      failed++;
      log.error(`Cron sync-all: transactions sync failed for item ${itemId}`, err);
    }
  }
  return { itemCount: itemIds.length, failed };
}

// Twice-daily safety net — re-syncs transactions for every item in case a
// webhook was missed. Vercel Hobby caps native Cron Jobs at once/day, so
// this runs on Upstash QStash instead (scripts/setup-qstash-schedule.ts),
// which POSTs in with a signed request rather than Vercel's own cron
// mechanism — see isAuthorizedQStashRequest. GET (Vercel-native, CRON_SECRET)
// stays supported too in case a Pro plan ever re-adds it to vercel.json.
async function GET_handler(req: Request) {
  if (!isAuthorizedCronRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const result = await runSyncAll();
  return NextResponse.json({ ok: true, ...result });
}

async function POST_handler(req: Request) {
  const rawBody = await req.text();
  if (!(await isAuthorizedQStashRequest(req, rawBody))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const result = await runSyncAll();
  return NextResponse.json({ ok: true, ...result });
}

export const GET = route(GET_handler);
export const POST = route(POST_handler);
