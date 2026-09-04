import { sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { plaidClient } from "@/lib/plaid";

/**
 * Upserts every account Plaid currently reports for this item — the same
 * per-account insert/update app/api/plaid/exchange/route.ts already ran
 * right after a brand-new connection, reused here so an update-mode Link
 * session (reauth, or adding an account within an existing connection via
 * account_selection_enabled — see app/api/plaid/link-token/route.ts) picks
 * up any newly-selected account too. lib/plaidBalances.ts's
 * refreshAccountBalances only ever UPDATEs by plaidAccountId — it can't
 * create the row a brand-new account needs before transactions can attach
 * to it, which otherwise silently drops that account's transactions (see
 * reconcileTransactions's "unknown account" skip in lib/plaidSync.ts).
 */
export async function upsertAccountsForItem(itemId: string, userId: string, accessToken: string): Promise<number> {
  const accountsRes = await plaidClient.accountsGet({ access_token: accessToken });

  for (const acct of accountsRes.data.accounts) {
    const limitCents = acct.balances.limit != null ? Math.round(acct.balances.limit * 100) : null;
    await db
      .insert(schema.accounts)
      .values({
        userId,
        itemId,
        plaidAccountId: acct.account_id,
        name: acct.name,
        officialName: acct.official_name ?? null,
        mask: acct.mask ?? null,
        type: acct.type,
        subtype: acct.subtype ?? null,
        currency: acct.balances.iso_currency_code ?? "USD",
        currentBalance: acct.balances.current != null ? Math.round(acct.balances.current * 100) : null,
        availableBalance: acct.balances.available != null ? Math.round(acct.balances.available * 100) : null,
        creditLimit: limitCents,
        balanceAsOf: new Date(),
      })
      .onConflictDoUpdate({
        target: schema.accounts.plaidAccountId,
        set: {
          currentBalance: acct.balances.current != null ? Math.round(acct.balances.current * 100) : null,
          availableBalance: acct.balances.available != null ? Math.round(acct.balances.available * 100) : null,
          // Re-linking an existing account: Plaid reporting a limit wins;
          // Plaid reporting nothing preserves a manually-entered one — see
          // the matching guard in lib/plaidBalances.ts.
          creditLimit:
            limitCents != null
              ? limitCents
              : sql`case when ${schema.accounts.creditLimitIsManual} then ${schema.accounts.creditLimit} else null end`,
          creditLimitIsManual: limitCents != null ? false : sql`${schema.accounts.creditLimitIsManual}`,
          balanceAsOf: new Date(),
        },
      });
  }

  return accountsRes.data.accounts.length;
}
