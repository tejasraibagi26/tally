import { isNull, sql } from "drizzle-orm";
import { schema } from "@/db";

/**
 * A disconnected bank (plaid_items.disconnected_at set) keeps its accounts and
 * transaction history, but its balances, holdings and card details are frozen
 * at the moment it was disconnected. These conditions keep those out of
 * anything that reads *current* money -- net worth, account totals, cards,
 * investments -- while transactions (and so spending, budgets and history)
 * still include them.
 */

/**
 * For queries on `accounts`: a manual account, or one whose bank is still
 * connected. The subquery names plaid_items' columns literally: drizzle's
 * relational queries (db.query.accounts.findMany) re-alias every column
 * reference in a where clause to the outer table, which turned
 * plaid_items.disconnected_at into a nonexistent accounts.disconnected_at.
 */
export const liveAccount = sql`(${schema.accounts.itemId} is null or ${schema.accounts.itemId} not in (select pi.id from plaid_items pi where pi.disconnected_at is not null))`;

/** For queries on `plaid_items`: still connected. */
export const liveItem = isNull(schema.plaidItems.disconnectedAt);

/** In-memory version of liveAccount, for rows already loaded alongside their items. */
export function isLiveAccountRow(account: { itemId: string | null }, disconnectedItemIds: ReadonlySet<string>): boolean {
  return account.itemId === null || !disconnectedItemIds.has(account.itemId);
}
