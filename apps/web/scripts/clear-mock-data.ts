import "dotenv/config";
import { inArray, like } from "drizzle-orm";
import { db, schema } from "../db";
import { isMockPlaidItemId } from "../lib/mock/isMock";

/**
 * Deletes every mock-mode item (plaidItemId starting with `mock-item-`) and
 * everything that cascades off it — accounts, transactions, holdings,
 * investment transactions, liabilities, balances, sync_runs. Real (Sandbox
 * or production) items are left untouched.
 *
 * `recurring_streams.account_id` has no ON DELETE cascade (a stream can
 * reference a since-deleted account by design), so those rows are removed
 * explicitly first — otherwise the FK blocks the account delete.
 *
 * Does not touch net_worth_snapshots — historical snapshots taken while
 * mock accounts existed remain as real history of what net worth was on
 * that day; today's snapshot gets recomputed correctly on the next sync.
 */
async function main() {
  const items = await db
    .select({ id: schema.plaidItems.id, plaidItemId: schema.plaidItems.plaidItemId, institutionName: schema.plaidItems.institutionName })
    .from(schema.plaidItems);
  const mockItems = items.filter((i) => isMockPlaidItemId(i.plaidItemId));

  if (mockItems.length === 0) {
    console.log("No mock items found — nothing to clean up.");
    process.exit(0);
  }

  const mockItemIds = mockItems.map((i) => i.id);
  const accounts = await db.select({ id: schema.accounts.id }).from(schema.accounts).where(inArray(schema.accounts.itemId, mockItemIds));
  const accountIds = accounts.map((a) => a.id);

  console.log(`Found ${mockItems.length} mock item(s): ${mockItems.map((i) => i.institutionName).join(", ")}`);
  console.log(`Deleting ${accountIds.length} account(s) and everything under them...`);

  if (accountIds.length > 0) {
    await db.delete(schema.recurringStreams).where(inArray(schema.recurringStreams.accountId, accountIds));
  }

  await db.delete(schema.plaidItems).where(inArray(schema.plaidItems.id, mockItemIds));
  await db.delete(schema.institutions).where(like(schema.institutions.id, "mock-%"));

  console.log("Done.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
