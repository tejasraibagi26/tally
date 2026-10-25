import { and, eq, isNotNull, notInArray, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { plaidClient } from "@/lib/plaid";
import { DEFAULT_CURRENCY } from "@tally/core/fx";

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
        currency: acct.balances.iso_currency_code ?? DEFAULT_CURRENCY,
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

  await pruneDeselectedAccounts(itemId, accountsRes.data.accounts.map((a) => a.account_id));

  return accountsRes.data.accounts.length;
}

/**
 * Update-mode Link lets the user untick an account; Plaid then stops
 * returning it from accountsGet, but its row here would sit forever with a
 * stale balance. Drops those rows -- only when nothing hangs off them, so a
 * deselected account with history is left alone rather than losing it.
 * Never runs on an empty list: that's more likely a bad response than
 * "the user deselected everything".
 */
async function pruneDeselectedAccounts(itemId: string, currentPlaidAccountIds: string[]): Promise<void> {
  if (currentPlaidAccountIds.length === 0) return;

  const gone = await db
    .select({ id: schema.accounts.id })
    .from(schema.accounts)
    .where(
      and(
        eq(schema.accounts.itemId, itemId),
        eq(schema.accounts.isManual, false),
        isNotNull(schema.accounts.plaidAccountId),
        notInArray(schema.accounts.plaidAccountId, currentPlaidAccountIds),
      ),
    );

  for (const { id } of gone) {
    const [hasTransactions, hasHoldings, hasInvestmentTransactions, hasRecurring] = await Promise.all([
      db.select({ id: schema.transactions.id }).from(schema.transactions).where(eq(schema.transactions.accountId, id)).limit(1),
      db.select({ id: schema.holdings.id }).from(schema.holdings).where(eq(schema.holdings.accountId, id)).limit(1),
      db.select({ id: schema.investmentTransactions.id }).from(schema.investmentTransactions).where(eq(schema.investmentTransactions.accountId, id)).limit(1),
      db.select({ id: schema.recurringStreams.id }).from(schema.recurringStreams).where(eq(schema.recurringStreams.accountId, id)).limit(1),
    ]);
    if (hasTransactions.length || hasHoldings.length || hasInvestmentTransactions.length || hasRecurring.length) continue;
    await db.delete(schema.accounts).where(eq(schema.accounts.id, id));
  }
}
