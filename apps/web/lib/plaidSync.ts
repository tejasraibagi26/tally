import { sql, eq, inArray } from "drizzle-orm";
import { db, schema } from "@/db";
import { plaidClient, getAccessToken, plaidErrorCode } from "@/lib/plaid";
import { upsertAccountsForItem } from "@/lib/plaidAccounts";
import { isMockPlaidItemId } from "@/lib/mock/isMock";
import { seedMockTransactionsForItem } from "@/lib/mock/seedTransactions";
import { toPlaidOwnedFields, mergeTransactionUpdate } from "@/lib/transactionSync/mapPlaidTransaction";
import { categorizeTransactions } from "@/lib/categorize";
import { detectTransfersForUser } from "@/lib/transfers";
import { detectRecurringForUser } from "@/lib/recurring";
import { computeAndStoreNetWorthSnapshot } from "@/lib/networth";
import type { Transaction as PlaidTransaction } from "plaid";

export type SyncTrigger = "webhook" | "cron" | "manual" | "initial";

export interface SyncResult {
  added: number;
  modified: number;
  removed: number;
}

/**
 * Runs /transactions/sync to completion for one item and reconciles the
 * result into Postgres, per WORK.md §6.3. Safe to call concurrently across
 * processes (Postgres advisory lock, non-blocking — a second caller skips
 * rather than queueing) and safe to re-run after a crash (the cursor is only
 * advanced after the DB transaction that used it commits).
 */
export async function syncTransactionsForItem(itemId: string, trigger: SyncTrigger): Promise<SyncResult | null> {
  const lockKey = sql`hashtext(${itemId})`;
  const lockRows = await db.execute<{ locked: boolean }>(sql`select pg_try_advisory_lock(${lockKey}) as locked`);
  if (!lockRows[0]?.locked) {
    console.warn(`Sync already in progress for item ${itemId}, skipping`);
    return null;
  }

  const startedAt = new Date();
  try {
    const [item] = await db
      .select()
      .from(schema.plaidItems)
      .where(eq(schema.plaidItems.id, itemId))
      .limit(1);
    if (!item) throw new Error(`Plaid item ${itemId} not found`);

    if (isMockPlaidItemId(item.plaidItemId)) {
      const result = await seedMockTransactionsForItem(itemId);
      await db
        .update(schema.plaidItems)
        .set({ lastSyncedAt: new Date(), status: "healthy" })
        .where(eq(schema.plaidItems.id, itemId));
      await recordSyncRun(itemId, trigger, startedAt, result);
      return result;
    }

    const accessToken = await getAccessToken(itemId);

    // Only on a manual sync (always what runs right after an update-mode
    // Link session, whether that was a plain reauth or the user selected an
    // additional account via account_selection_enabled) — an extra
    // accountsGet call on every webhook/cron-triggered sync isn't worth the
    // Plaid API load just to catch the rare case of an account appearing
    // without the user ever going through update mode. Must run before the
    // transactions loop below: a new account has to exist in `accounts`
    // before reconcileTransactions can attach anything to it, or those
    // transactions get silently skipped (see the "unknown account" branch
    // in reconcileTransactions).
    if (trigger === "manual") {
      try {
        await upsertAccountsForItem(itemId, item.userId, accessToken);
      } catch (err) {
        console.error(`upsertAccountsForItem failed for item ${itemId}`, err);
      }
    }

    const added: PlaidTransaction[] = [];
    const modified: PlaidTransaction[] = [];
    const removed: { transaction_id: string }[] = [];
    // Plaid can hand back next_cursor: "" while its initial historical pull
    // for an item is still in progress — normalize that to undefined so the
    // request omits `cursor` entirely rather than resending a literal empty
    // string, which some APIs treat differently from the field being absent.
    let cursor = item.transactionsCursor || undefined;
    let hasMore = true;
    // Last page's value wins — the only one that matters is where things
    // stood once the loop below finished.
    let transactionsUpdateStatus: string | undefined;

    while (hasMore) {
      const res = await plaidClient.transactionsSync({
        access_token: accessToken,
        cursor,
        count: 500,
        options: { include_original_description: true },
      });
      added.push(...res.data.added);
      modified.push(...res.data.modified);
      removed.push(...res.data.removed);
      cursor = res.data.next_cursor || undefined;
      hasMore = res.data.has_more;
      transactionsUpdateStatus = res.data.transactions_update_status;
    }

    const result = await reconcileTransactions(item.userId, itemId, added, modified, removed, cursor, transactionsUpdateStatus);

    // Best-effort enrichment: categorization/transfer-pairing failures must
    // never fail the sync itself (the cursor already advanced and the core
    // financial data is correct) — log and let the next sync's rows, or a
    // future rule/manual edit, catch anything missed here.
    try {
      const incomingIds = [...added, ...modified].map((t) => t.transaction_id);
      if (incomingIds.length > 0) {
        const affected = await db
          .select({ id: schema.transactions.id })
          .from(schema.transactions)
          .where(inArray(schema.transactions.plaidTransactionId, incomingIds));
        await categorizeTransactions(item.userId, affected.map((r) => r.id));
      }
      if (result.added > 0 || result.modified > 0) {
        await detectTransfersForUser(item.userId);
        await detectRecurringForUser(item.userId);
      }
      // Keeps today's net-worth snapshot live-updated intraday as balances
      // change; once the date rolls over, today's final value becomes a
      // permanent history point rather than being overwritten again.
      await computeAndStoreNetWorthSnapshot(item.userId, new Date().toISOString().slice(0, 10));
    } catch (err) {
      console.error(`Categorization/transfer detection failed for item ${itemId}`, err);
    }

    await recordSyncRun(itemId, trigger, startedAt, result);
    return result;
  } catch (err) {
    console.error(`Transaction sync failed for item ${itemId} (${plaidErrorCode(err) ?? "unknown error"})`);
    await db.insert(schema.syncRuns).values({
      itemId,
      kind: "transactions",
      trigger,
      startedAt,
      finishedAt: new Date(),
      error: err instanceof Error ? err.message : "unknown error",
    });
    throw err;
  } finally {
    await db.execute(sql`select pg_advisory_unlock(${lockKey})`);
  }
}

async function recordSyncRun(itemId: string, trigger: SyncTrigger, startedAt: Date, result: SyncResult) {
  await db.insert(schema.syncRuns).values({
    itemId,
    kind: "transactions",
    trigger,
    startedAt,
    finishedAt: new Date(),
    added: result.added,
    modified: result.modified,
    removed: result.removed,
  });
}

async function reconcileTransactions(
  userId: string,
  itemId: string,
  added: PlaidTransaction[],
  modified: PlaidTransaction[],
  removed: { transaction_id: string }[],
  cursor: string | undefined,
  transactionsUpdateStatus: string | undefined,
): Promise<SyncResult> {
  const incoming = [...added, ...modified];
  if (incoming.length === 0 && removed.length === 0) {
    await db
      .update(schema.plaidItems)
      .set({ transactionsCursor: cursor, transactionsUpdateStatus, lastSyncedAt: new Date(), status: "healthy" })
      .where(eq(schema.plaidItems.id, itemId));
    return { added: 0, modified: 0, removed: 0 };
  }

  // Plaid's own account_id -> our internal accounts.id.
  const plaidAccountIds = [...new Set(incoming.map((t) => t.account_id))];
  const accountRows = plaidAccountIds.length
    ? await db
        .select({ id: schema.accounts.id, plaidAccountId: schema.accounts.plaidAccountId })
        .from(schema.accounts)
        .where(inArray(schema.accounts.plaidAccountId, plaidAccountIds))
    : [];
  const accountIdByPlaidId = new Map(accountRows.map((a) => [a.plaidAccountId, a.id]));

  const incomingIds = incoming.map((t) => t.transaction_id);
  const existingRows = incomingIds.length
    ? await db
        .select({ id: schema.transactions.id, plaidTransactionId: schema.transactions.plaidTransactionId, categorySource: schema.transactions.categorySource })
        .from(schema.transactions)
        .where(inArray(schema.transactions.plaidTransactionId, incomingIds))
    : [];
  const existingByPlaidId = new Map(existingRows.map((r) => [r.plaidTransactionId, r]));

  let addedCount = 0;
  let modifiedCount = 0;

  await db.transaction(async (tx) => {
    for (const t of incoming) {
      const accountId = accountIdByPlaidId.get(t.account_id);
      if (!accountId) {
        console.warn(`Skipping transaction ${t.transaction_id}: unknown account ${t.account_id}`);
        continue;
      }
      const existing = existingByPlaidId.get(t.transaction_id);
      const values = mergeTransactionUpdate(existing, toPlaidOwnedFields(t));

      if (!existing) {
        await tx.insert(schema.transactions).values({
          userId,
          accountId,
          ...values,
          categoryId: values.categoryId ?? null,
          categorySource: values.categorySource ?? "plaid",
          tags: values.tags ?? [],
          excludedFromBudget: values.excludedFromBudget ?? false,
        });
        addedCount++;
      } else {
        await tx.update(schema.transactions).set({ ...values, updatedAt: new Date() }).where(eq(schema.transactions.id, existing.id));
        modifiedCount++;
      }
    }

    // Pending -> posted reconciliation: a newly-added/modified row that
    // carries pending_transaction_id points at the old pending row. Carry
    // its user-owned fields forward, then remove the superseded pending row.
    for (const t of incoming) {
      if (!t.pending_transaction_id) continue;
      const [oldPending] = await tx
        .select()
        .from(schema.transactions)
        .where(eq(schema.transactions.plaidTransactionId, t.pending_transaction_id))
        .limit(1);
      if (!oldPending) continue;

      if (oldPending.categorySource === "manual" || oldPending.categorySource === "rule") {
        await tx
          .update(schema.transactions)
          .set({
            categoryId: oldPending.categoryId,
            categorySource: oldPending.categorySource,
          })
          .where(eq(schema.transactions.plaidTransactionId, t.transaction_id));
      }
      await tx
        .update(schema.transactions)
        .set({ notes: oldPending.notes, tags: oldPending.tags, excludedFromBudget: oldPending.excludedFromBudget })
        .where(eq(schema.transactions.plaidTransactionId, t.transaction_id));

      await tx.delete(schema.transactions).where(eq(schema.transactions.id, oldPending.id));
    }

    if (removed.length > 0) {
      await tx.delete(schema.transactions).where(
        inArray(
          schema.transactions.plaidTransactionId,
          removed.map((r) => r.transaction_id),
        ),
      );
    }

    // Cursor only advances once everything above has committed — a crash
    // before this line means the next run replays the same page instead of
    // silently skipping it.
    await tx
      .update(schema.plaidItems)
      .set({ transactionsCursor: cursor, transactionsUpdateStatus, lastSyncedAt: new Date(), status: "healthy" })
      .where(eq(schema.plaidItems.id, itemId));
  });

  return { added: addedCount, modified: modifiedCount, removed: removed.length };
}
