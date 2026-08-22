import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { plaidClient, getAccessToken } from "@/lib/plaid";
import { isMockPlaidItemId } from "@/lib/mock/isMock";
import type { SyncTrigger } from "@/lib/plaidSync";

/**
 * Forces a fresh balance pull (§6.6) and records a `balances` sync_runs row
 * so the Connections screen's freshness badge reflects it. No-ops for mock
 * items, which have no real access token.
 */
export async function refreshAccountBalances(itemId: string, trigger: SyncTrigger): Promise<void> {
  const startedAt = new Date();
  const [item] = await db
    .select({ plaidItemId: schema.plaidItems.plaidItemId })
    .from(schema.plaidItems)
    .where(eq(schema.plaidItems.id, itemId))
    .limit(1);
  if (!item || isMockPlaidItemId(item.plaidItemId)) return;

  try {
    const accessToken = await getAccessToken(itemId);
    const balances = await plaidClient.accountsBalanceGet({ access_token: accessToken });

    for (const acct of balances.data.accounts) {
      await db
        .update(schema.accounts)
        .set({
          currentBalance: acct.balances.current != null ? Math.round(acct.balances.current * 100) : null,
          availableBalance: acct.balances.available != null ? Math.round(acct.balances.available * 100) : null,
          creditLimit: acct.balances.limit != null ? Math.round(acct.balances.limit * 100) : null,
          balanceAsOf: new Date(),
        })
        .where(eq(schema.accounts.plaidAccountId, acct.account_id));
    }

    await db.insert(schema.syncRuns).values({
      itemId,
      kind: "balances",
      trigger,
      startedAt,
      finishedAt: new Date(),
      added: balances.data.accounts.length,
    });
  } catch (err) {
    await db.insert(schema.syncRuns).values({
      itemId,
      kind: "balances",
      trigger,
      startedAt,
      finishedAt: new Date(),
      error: err instanceof Error ? err.message : "unknown error",
    });
    throw err;
  }
}
