import PgBoss from "pg-boss";
import type { SyncTrigger } from "@/lib/plaidSync";

// Shared job queue (WORK.md §8): the Next.js server sends jobs (webhook
// route, cron handlers), `worker/index.ts` processes them. Both sides call
// getBoss() and get the same lazily-started, per-process singleton — pg-boss
// multiplexes many senders/workers over the same Postgres-backed queue fine.
export const QUEUE_SYNC_TRANSACTIONS = "sync-transactions";
export const QUEUE_SYNC_HOLDINGS = "sync-holdings";
export const QUEUE_SYNC_INVESTMENT_TRANSACTIONS = "sync-investment-transactions";
export const QUEUE_SYNC_LIABILITIES = "sync-liabilities";
export const QUEUE_CRON_SYNC_ALL = "cron-sync-all";
export const QUEUE_NIGHTLY_BALANCES = "nightly-balance-refresh";

const ALL_QUEUES = [
  QUEUE_SYNC_TRANSACTIONS,
  QUEUE_SYNC_HOLDINGS,
  QUEUE_SYNC_INVESTMENT_TRANSACTIONS,
  QUEUE_SYNC_LIABILITIES,
  QUEUE_CRON_SYNC_ALL,
  QUEUE_NIGHTLY_BALANCES,
];

/** Shared shape for every "sync one item" job — same fields regardless of which product it's syncing. */
export interface ItemSyncJobData {
  itemId: string;
  trigger: SyncTrigger;
  webhookEventId?: string;
}

export type SyncTransactionsJobData = ItemSyncJobData;

let bossPromise: Promise<PgBoss> | null = null;

async function createBoss(): Promise<PgBoss> {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not set");

  const boss = new PgBoss({ connectionString: process.env.DATABASE_URL });
  boss.on("error", (err) => console.error("pg-boss error", err));
  await boss.start();

  // createQueue is idempotent — safe to call from every process on startup.
  for (const queue of ALL_QUEUES) await boss.createQueue(queue);

  return boss;
}

export function getBoss(): Promise<PgBoss> {
  if (!bossPromise) bossPromise = createBoss();
  return bossPromise;
}

const RETRY_OPTIONS = { retryLimit: 5, retryDelay: 5, retryBackoff: true };

/** Enqueues one item's sync job per WORK.md §8.2 job hygiene: bounded retries with backoff+jitter. */
async function enqueue(queue: string, data: ItemSyncJobData) {
  const boss = await getBoss();
  return boss.send(queue, data, RETRY_OPTIONS);
}

export const enqueueSyncTransactions = (data: ItemSyncJobData) => enqueue(QUEUE_SYNC_TRANSACTIONS, data);
export const enqueueSyncHoldings = (data: ItemSyncJobData) => enqueue(QUEUE_SYNC_HOLDINGS, data);
export const enqueueSyncInvestmentTransactions = (data: ItemSyncJobData) => enqueue(QUEUE_SYNC_INVESTMENT_TRANSACTIONS, data);
export const enqueueSyncLiabilities = (data: ItemSyncJobData) => enqueue(QUEUE_SYNC_LIABILITIES, data);
