import { eq, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { plaidClient, getAccessToken, plaidErrorCode } from "@/lib/plaid";
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
      const limitCents = acct.balances.limit != null ? Math.round(acct.balances.limit * 100) : null;
      await db
        .update(schema.accounts)
        .set({
          currentBalance: acct.balances.current != null ? Math.round(acct.balances.current * 100) : null,
          availableBalance: acct.balances.available != null ? Math.round(acct.balances.available * 100) : null,
          // Plaid reporting a limit always wins (and clears the manual flag —
          // Plaid is authoritative again); Plaid reporting nothing preserves
          // whatever the user entered by hand instead of nulling it out.
          creditLimit:
            limitCents != null
              ? limitCents
              : sql`case when ${schema.accounts.creditLimitIsManual} then ${schema.accounts.creditLimit} else null end`,
          creditLimitIsManual: limitCents != null ? false : sql`${schema.accounts.creditLimitIsManual}`,
          balanceAsOf: new Date(),
        })
        .where(eq(schema.accounts.plaidAccountId, acct.account_id));
    }

    // Balances-only syncs used to leave `lastSyncedAt`/`status` untouched --
    // only the transactions sync path (plaidSync.ts) wrote them -- so the
    // freshness badge and "Updated Nh ago" text kept showing whenever a
    // transactions sync last ran, ignoring balance refreshes entirely.
    await db
      .update(schema.plaidItems)
      .set({ lastSyncedAt: new Date(), status: "healthy" })
      .where(eq(schema.plaidItems.id, itemId));

    await db.insert(schema.syncRuns).values({
      itemId,
      kind: "balances",
      trigger,
      startedAt,
      finishedAt: new Date(),
      added: balances.data.accounts.length,
    });
  } catch (err) {
    // The generic AxiosError message ("Request failed with status code 400")
    // was the only thing ever recorded/logged here -- Plaid's actual
    // error_code/error_message (in err.response.data, several levels deep in
    // the Axios error) gets truncated to "[Object]" by console.error's
    // default inspection depth and was never pulled out for the sync_runs
    // row either, making a failed balance refresh nearly undiagnosable
    // after the fact.
    const code = plaidErrorCode(err);
    const message = err instanceof Error ? err.message : "unknown error";
    console.error(`refreshAccountBalances failed for item ${itemId}`, { code, message });
    await db.insert(schema.syncRuns).values({
      itemId,
      kind: "balances",
      trigger,
      startedAt,
      finishedAt: new Date(),
      error: code ? `${code}: ${message}` : message,
    });
    throw err;
  }
}
