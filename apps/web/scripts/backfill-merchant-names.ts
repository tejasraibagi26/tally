import "dotenv/config";
import { db, schema } from "../db";
import { refreshMerchantNames } from "../lib/merchantRenames";

/**
 * Sync now shows the bank's description instead of Plaid's merchant_name
 * when the two share no word (resolveMerchantName in
 * @tally/core/merchantName) -- e.g. "SONNET INSURANCE" no longer shows as
 * "Child Net". New and modified transactions get that on their own; this
 * re-derives merchant_name on every synced transaction already stored, and
 * retargets merchant rules pointing at a name that changed. Safe to re-run.
 */
async function main() {
  const users = await db.select({ id: schema.users.id }).from(schema.users);
  console.log(`Refreshing merchant names for ${users.length} user(s)...`);
  for (const u of users) {
    const n = await refreshMerchantNames(u.id);
    console.log(`  ${u.id}: ${n} synced transaction(s) checked`);
  }
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
