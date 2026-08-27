import "dotenv/config";
import { inArray } from "drizzle-orm";
import { db, schema } from "../db";

/**
 * Deletes every Plaid item (real and mock) and everything that cascades off
 * it — accounts, balances, transactions, splits, holdings, investment
 * transactions, liabilities, sync_runs — plus net_worth_snapshots. Leaves
 * users, categories, rules, and budgets untouched.
 *
 * Does not call Plaid's item/remove first: items left over from a stale
 * PLAID_CLIENT_ID/PLAID_SECRET pair can't be removed anyway (400 from
 * Plaid), and sandbox items don't need graceful teardown on Plaid's side.
 *
 * `recurring_streams.account_id` has no ON DELETE cascade (a stream can
 * reference a since-deleted account by design), so those rows are removed
 * explicitly first — otherwise the FK blocks the account delete.
 */
async function main() {
  const items = await db.select({ id: schema.plaidItems.id, institutionName: schema.plaidItems.institutionName }).from(schema.plaidItems);

  if (items.length === 0) {
    console.log("No Plaid items found — nothing to clean up.");
    process.exit(0);
  }

  const itemIds = items.map((i) => i.id);
  const accounts = await db.select({ id: schema.accounts.id }).from(schema.accounts).where(inArray(schema.accounts.itemId, itemIds));
  const accountIds = accounts.map((a) => a.id);

  console.log(`Found ${items.length} item(s): ${items.map((i) => i.institutionName).join(", ")}`);
  console.log(`Deleting ${accountIds.length} account(s) and everything under them...`);

  if (accountIds.length > 0) {
    await db.delete(schema.recurringStreams).where(inArray(schema.recurringStreams.accountId, accountIds));
  }

  await db.delete(schema.plaidItems).where(inArray(schema.plaidItems.id, itemIds));
  await db.delete(schema.netWorthSnapshots);

  console.log("Done.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
