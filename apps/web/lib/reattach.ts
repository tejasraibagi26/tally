import { and, desc, eq, inArray, isNotNull } from "drizzle-orm";
import type { AccountBase } from "plaid";
import { db, schema } from "@/db";
import { plaidClient, getAccessToken, plaidErrorCode } from "@/lib/plaid";
import { isMockPlaidItemId } from "@/lib/mock/isMock";
import { recordAudit } from "@/lib/audit";
import { pairReattached } from "@/lib/reattachPairing";

/**
 * Disconnecting keeps a bank's history; reconnecting the same institution
 * picks it back up. The pieces:
 *
 * - disconnectItem: removes access at Plaid and stops syncing, keeps the
 *   item, accounts and posted transactions.
 * - matchKeptAccounts / reattach: on a new connection to an institution the
 *   user disconnected before, reuse the old item row and point the kept
 *   accounts at the new Plaid account ids, so the next upsert updates them
 *   in place instead of creating duplicates.
 * - dedupeReattached: Plaid gives the re-pulled history (up to ~24 months)
 *   brand-new transaction ids, so it overlaps what was kept. Each re-synced
 *   row is paired with its kept twin (same account, date, amount, name); the
 *   user's edits move onto the new row and the old one goes. Kept rows older
 *   than what Plaid re-sends simply stay. It runs after every transactions
 *   sync for REATTACH_WINDOW_DAYS, because some banks (TD) deliver history
 *   late.
 */

const REATTACH_WINDOW_DAYS = 30;

/** Stop syncing a bank but keep everything it has synced so far. */
export async function disconnectItem(itemId: string, userId: string): Promise<{ institutionName: string | null; accountCount: number }> {
  const [item] = await db
    .select({ id: schema.plaidItems.id, plaidItemId: schema.plaidItems.plaidItemId, institutionName: schema.plaidItems.institutionName })
    .from(schema.plaidItems)
    .where(and(eq(schema.plaidItems.id, itemId), eq(schema.plaidItems.userId, userId)))
    .limit(1);
  if (!item) throw new Error(`Plaid item ${itemId} not found`);

  if (!isMockPlaidItemId(item.plaidItemId)) {
    try {
      const accessToken = await getAccessToken(itemId);
      await plaidClient.itemRemove({ access_token: accessToken });
    } catch (err) {
      // Already revoked or dead on Plaid's side: still disconnect locally so
      // the user isn't stuck with a connection they asked to end.
      console.error(`item/remove failed (${plaidErrorCode(err) ?? "unknown error"}), disconnecting locally anyway`);
    }
  }

  const accounts = await db.select({ id: schema.accounts.id }).from(schema.accounts).where(eq(schema.accounts.itemId, itemId));
  const accountIds = accounts.map((a) => a.id);

  await db.transaction(async (tx) => {
    // A pending charge can never post now -- it would sit in the history
    // as "pending" forever. Posted rows are the history we keep.
    if (accountIds.length > 0) {
      await tx
        .delete(schema.transactions)
        .where(and(inArray(schema.transactions.accountId, accountIds), eq(schema.transactions.isPending, true), eq(schema.transactions.isManual, false)));
    }
    await tx
      .update(schema.plaidItems)
      .set({ disconnectedAt: new Date(), transactionsCursor: null, lastErrorCode: null })
      .where(eq(schema.plaidItems.id, itemId));
  });

  return { institutionName: item.institutionName, accountCount: accountIds.length };
}

/** The most recently disconnected item this user had at this institution, if any. */
export async function findDisconnectedItem(userId: string, institutionId: string): Promise<{ id: string } | null> {
  const [item] = await db
    .select({ id: schema.plaidItems.id })
    .from(schema.plaidItems)
    .where(
      and(
        eq(schema.plaidItems.userId, userId),
        eq(schema.plaidItems.institutionId, institutionId),
        isNotNull(schema.plaidItems.disconnectedAt),
      ),
    )
    .orderBy(desc(schema.plaidItems.disconnectedAt))
    .limit(1);
  return item ?? null;
}

/**
 * Pairs the new connection's Plaid accounts with the item's kept accounts by
 * last four, type and subtype (name as a tie-breaker). Only unambiguous pairs
 * count. Returns kept account id → new Plaid account id.
 */
export async function matchKeptAccounts(itemId: string, plaidAccounts: AccountBase[]): Promise<Map<string, string>> {
  const kept = await db
    .select({ id: schema.accounts.id, name: schema.accounts.name, mask: schema.accounts.mask, type: schema.accounts.type, subtype: schema.accounts.subtype })
    .from(schema.accounts)
    .where(eq(schema.accounts.itemId, itemId));

  const key = (a: { mask: string | null | undefined; type: string; subtype: string | null | undefined }) => `${a.mask ?? ""}|${a.type}|${a.subtype ?? ""}`;
  const matches = new Map<string, string>();
  const usedKept = new Set<string>();

  for (const acct of plaidAccounts) {
    const candidates = kept.filter((k) => !usedKept.has(k.id) && key(k) === key({ mask: acct.mask, type: acct.type, subtype: acct.subtype }));
    const pick = candidates.length === 1 ? candidates[0] : candidates.find((k) => k.name === acct.name);
    if (!pick || !acct.mask) continue;
    matches.set(pick.id, acct.account_id);
    usedKept.add(pick.id);
  }
  return matches;
}

/**
 * Reuses a disconnected item for a new Plaid connection: new token and ids,
 * syncing back on, kept accounts re-pointed at their new Plaid account ids.
 */
export async function reattachItem({
  itemId,
  userId,
  plaidItemId,
  institutionName,
  token,
  consentedProducts,
  availableProducts,
  accountMatches,
}: {
  itemId: string;
  userId: string;
  plaidItemId: string;
  institutionName: string | null;
  token: { accessTokenCiphertext: string; accessTokenIv: string; accessTokenTag: string };
  consentedProducts: string[];
  availableProducts: string[];
  accountMatches: Map<string, string>;
}): Promise<void> {
  await db.transaction(async (tx) => {
    await tx
      .update(schema.plaidItems)
      .set({
        plaidItemId,
        ...(institutionName ? { institutionName } : {}),
        ...token,
        status: "healthy",
        lastErrorCode: null,
        consentedProducts,
        availableProducts,
        transactionsCursor: null,
        transactionsUpdateStatus: null,
        disconnectedAt: null,
        reattachedAt: new Date(),
      })
      .where(eq(schema.plaidItems.id, itemId));
    for (const [accountId, plaidAccountId] of accountMatches) {
      await tx.update(schema.accounts).set({ plaidAccountId }).where(eq(schema.accounts.id, accountId));
    }
  });

  await recordAudit({
    userId,
    action: "plaid_item.reconnected",
    entity: "plaid_items",
    entityId: itemId,
    after: { institutionName, accountsMatched: accountMatches.size },
  });
}

/**
 * Pairs transactions synced since the reconnect with their kept twins and
 * folds each pair into the new row. Idempotent: matched old rows are
 * deleted, so a later run only sees what's still unpaired.
 */
export async function dedupeReattached(itemId: string, reattachedAt: Date): Promise<number> {
  if (Date.now() - reattachedAt.getTime() > REATTACH_WINDOW_DAYS * 86_400_000) return 0;

  const accounts = await db.select({ id: schema.accounts.id }).from(schema.accounts).where(eq(schema.accounts.itemId, itemId));
  if (accounts.length === 0) return 0;

  const rows = await db
    .select({
      id: schema.transactions.id,
      accountId: schema.transactions.accountId,
      postedDate: schema.transactions.postedDate,
      amount: schema.transactions.amount,
      name: schema.transactions.name,
      merchantName: schema.transactions.merchantName,
      isPending: schema.transactions.isPending,
      createdAt: schema.transactions.createdAt,
      categoryId: schema.transactions.categoryId,
      categorySource: schema.transactions.categorySource,
      notes: schema.transactions.notes,
      tags: schema.transactions.tags,
      reviewed: schema.transactions.reviewed,
      excludedFromBudget: schema.transactions.excludedFromBudget,
      isTransfer: schema.transactions.isTransfer,
      transferGroupId: schema.transactions.transferGroupId,
      recurringStreamId: schema.transactions.recurringStreamId,
    })
    .from(schema.transactions)
    .where(
      and(
        inArray(
          schema.transactions.accountId,
          accounts.map((a) => a.id),
        ),
        eq(schema.transactions.isManual, false),
        isNotNull(schema.transactions.plaidTransactionId),
      ),
    );

  const kept = rows.filter((r) => r.createdAt < reattachedAt);
  const fresh = rows.filter((r) => r.createdAt >= reattachedAt && !r.isPending);
  if (kept.length === 0 || fresh.length === 0) return 0;

  const pairs = pairReattached(kept, fresh);
  if (pairs.length === 0) return 0;

  const oldIds = pairs.map(([o]) => o.id);
  const splitRows = await db
    .select({ transactionId: schema.transactionSplits.transactionId })
    .from(schema.transactionSplits)
    .where(inArray(schema.transactionSplits.transactionId, [...oldIds, ...pairs.map(([, n]) => n.id)]));
  const hasSplits = new Set(splitRows.map((s) => s.transactionId));

  await db.transaction(async (tx) => {
    for (const [old, fresh] of pairs) {
      const update: Partial<typeof schema.transactions.$inferInsert> = {
        reviewed: old.reviewed || fresh.reviewed,
        excludedFromBudget: old.excludedFromBudget,
        tags: [...new Set([...(fresh.tags ?? []), ...(old.tags ?? [])])],
      };
      if (old.categorySource === "manual") {
        update.categoryId = old.categoryId;
        update.categorySource = "manual";
      }
      if (old.notes && !fresh.notes) update.notes = old.notes;
      if (old.recurringStreamId && !fresh.recurringStreamId) update.recurringStreamId = old.recurringStreamId;
      if (old.isTransfer) {
        // Keeps the pairing with the other side, which shares this group id.
        update.isTransfer = true;
        update.transferGroupId = old.transferGroupId;
      }
      await tx.update(schema.transactions).set(update).where(eq(schema.transactions.id, fresh.id));
      if (hasSplits.has(old.id) && !hasSplits.has(fresh.id)) {
        await tx.update(schema.transactionSplits).set({ transactionId: fresh.id }).where(eq(schema.transactionSplits.transactionId, old.id));
      }
    }
    await tx.delete(schema.transactions).where(inArray(schema.transactions.id, oldIds));
  });

  return pairs.length;
}
