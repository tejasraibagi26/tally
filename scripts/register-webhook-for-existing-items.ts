import "dotenv/config";
import { eq } from "drizzle-orm";
import { db, schema } from "../db";
import { plaidClient, getAccessToken, PLAID_WEBHOOK_URL } from "../lib/plaid";
import { isMockPlaidItemId } from "../lib/mock/isMock";

/**
 * New items pick up PLAID_WEBHOOK_URL automatically (it's passed at
 * /link/token/create — see app/api/plaid/link-token/route.ts). Items
 * connected before PLAID_WEBHOOK_URL was set don't retroactively get one —
 * Plaid only knows the webhook URL an item was given at Link time — so this
 * calls /item/webhook/update once per already-connected item to register it
 * without requiring anyone to reconnect. Safe to re-run.
 */
async function main() {
  if (!PLAID_WEBHOOK_URL) {
    throw new Error("PLAID_WEBHOOK_URL is not set in this environment — set it in Vercel and redeploy before running this.");
  }

  const items = await db.select({ id: schema.plaidItems.id, institutionName: schema.plaidItems.institutionName, plaidItemId: schema.plaidItems.plaidItemId }).from(schema.plaidItems);
  const real = items.filter((i) => !isMockPlaidItemId(i.plaidItemId));
  console.log(`Registering webhook for ${real.length} item(s) (${items.length - real.length} mock item(s) skipped)...`);

  for (const item of real) {
    try {
      const accessToken = await getAccessToken(item.id);
      await plaidClient.itemWebhookUpdate({ access_token: accessToken, webhook: PLAID_WEBHOOK_URL });
      console.log(`  ${item.institutionName}: OK`);
    } catch (err) {
      console.error(`  ${item.institutionName}: FAILED —`, err instanceof Error ? err.message : err);
    }
  }

  console.log("Done.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
