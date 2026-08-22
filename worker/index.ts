import "dotenv/config";
import PgBoss from "pg-boss";
import { eq, notInArray, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { syncTransactionsForItem } from "@/lib/plaidSync";
import { refreshAccountBalances } from "@/lib/plaidBalances";
import { syncHoldingsForItem, syncInvestmentTransactionsForItem } from "@/lib/plaidInvestments";
import { syncLiabilitiesForItem } from "@/lib/plaidLiabilities";
import { computeAndStoreNetWorthSnapshot } from "@/lib/networth";
import {
  getBoss,
  QUEUE_SYNC_TRANSACTIONS,
  QUEUE_SYNC_HOLDINGS,
  QUEUE_SYNC_INVESTMENT_TRANSACTIONS,
  QUEUE_SYNC_LIABILITIES,
  QUEUE_CRON_SYNC_ALL,
  QUEUE_NIGHTLY_BALANCES,
  type ItemSyncJobData,
} from "@/lib/queue";

// Milestones 3 & 5 (WORK.md §8, §12): pg-boss job processing for
// webhook-triggered and cron-scheduled syncs. Run with `npm run worker`,
// alongside the app — see docker-compose.yml / README for the two-process
// layout.
const CRON_TZ = process.env.CRON_TZ ?? "America/New_York";

// Items in these states need re-auth before another sync attempt is useful
// (§6.8) — cron safety nets skip them rather than retrying pointlessly.
const SYNC_BLOCKED_STATUSES = ["login_required", "revoked"] as const;

async function activeItems(): Promise<{ id: string; userId: string }[]> {
  return db
    .select({ id: schema.plaidItems.id, userId: schema.plaidItems.userId })
    .from(schema.plaidItems)
    .where(notInArray(schema.plaidItems.status, [...SYNC_BLOCKED_STATUSES]));
}

async function activeItemIds(): Promise<string[]> {
  return (await activeItems()).map((i) => i.id);
}

/**
 * Wires one "sync a single item" job queue: runs `syncFn`, and if the job
 * came from a webhook, reflects success/failure onto that `webhook_events`
 * row. A thrown error propagates to pg-boss so retryLimit/retryBackoff (§8.2)
 * apply — each sync function only throws for a genuine failure, never for a
 * "this institution doesn't support this product" no-op.
 */
function registerItemSyncWorker(
  boss: PgBoss,
  queue: string,
  syncFn: (itemId: string, trigger: ItemSyncJobData["trigger"]) => Promise<unknown>,
) {
  boss.work<ItemSyncJobData>(queue, async (jobs) => {
    for (const job of jobs) {
      const { itemId, trigger, webhookEventId } = job.data;
      try {
        await syncFn(itemId, trigger);
        if (webhookEventId) {
          await db
            .update(schema.webhookEvents)
            .set({ status: "processed", processedAt: new Date() })
            .where(eq(schema.webhookEvents.id, webhookEventId));
        }
      } catch (err) {
        if (webhookEventId) {
          await db
            .update(schema.webhookEvents)
            .set({
              status: "failed",
              error: err instanceof Error ? err.message : "unknown error",
              attempts: sql`${schema.webhookEvents.attempts} + 1`,
            })
            .where(eq(schema.webhookEvents.id, webhookEventId));
        }
        throw err;
      }
    }
  });
}

async function main() {
  const boss = await getBoss();

  registerItemSyncWorker(boss, QUEUE_SYNC_TRANSACTIONS, syncTransactionsForItem);
  registerItemSyncWorker(boss, QUEUE_SYNC_HOLDINGS, syncHoldingsForItem);
  registerItemSyncWorker(boss, QUEUE_SYNC_INVESTMENT_TRANSACTIONS, syncInvestmentTransactionsForItem);
  registerItemSyncWorker(boss, QUEUE_SYNC_LIABILITIES, syncLiabilitiesForItem);

  // Cron safety net (§8.1): every item, twice a day, in case a webhook was
  // missed. Fans out into individual sync-transactions jobs rather than
  // syncing inline, so one slow/broken item can't hold up the others.
  boss.work(QUEUE_CRON_SYNC_ALL, async () => {
    for (const itemId of await activeItemIds()) {
      await boss.send(QUEUE_SYNC_TRANSACTIONS, { itemId, trigger: "cron" } satisfies ItemSyncJobData, {
        retryLimit: 5,
        retryDelay: 5,
        retryBackoff: true,
      });
    }
  });
  await boss.schedule(QUEUE_CRON_SYNC_ALL, "0 6,18 * * *", {}, { tz: CRON_TZ });

  // Nightly (§8.1): balance refresh, holdings snapshot, liabilities, and a
  // net-worth snapshot for every item. Budget rollover isn't a job — it's
  // computed on read (lib/budgets.ts). Recurring re-detection isn't here
  // either — it already runs after every transaction sync that finds
  // something new (lib/plaidSync.ts).
  boss.work(QUEUE_NIGHTLY_BALANCES, async () => {
    const today = new Date().toISOString().slice(0, 10);
    for (const item of await activeItems()) {
      try {
        await refreshAccountBalances(item.id, "cron");
      } catch (err) {
        console.error(`Nightly balance refresh failed for item ${item.id}`, err);
      }
      try {
        await syncHoldingsForItem(item.id, "cron");
      } catch (err) {
        console.error(`Nightly holdings sync failed for item ${item.id}`, err);
      }
      try {
        await syncLiabilitiesForItem(item.id, "cron");
      } catch (err) {
        console.error(`Nightly liabilities sync failed for item ${item.id}`, err);
      }
      try {
        await computeAndStoreNetWorthSnapshot(item.userId, today);
      } catch (err) {
        console.error(`Nightly net-worth snapshot failed for user ${item.userId}`, err);
      }
    }
  });
  await boss.schedule(QUEUE_NIGHTLY_BALANCES, "0 2 * * *", {}, { tz: CRON_TZ });

  console.log(`Tally worker: listening (cron timezone ${CRON_TZ}).`);

  for (const signal of ["SIGINT", "SIGTERM"] as const) {
    process.on(signal, async () => {
      await boss.stop();
      process.exit(0);
    });
  }
}

main().catch((err) => {
  console.error("Worker failed to start", err);
  process.exit(1);
});
