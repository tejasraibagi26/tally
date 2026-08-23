import "dotenv/config";
import { ilike } from "drizzle-orm";
import type { CountryCode } from "plaid";
import { db, schema } from "../db";
import { plaidClient, getAccessToken } from "../lib/plaid";

// One-off diagnostic — not wired into the app. Run against whichever
// DATABASE_URL/PLAID_* env you point it at:
//   npx tsx scripts/debug-item-sync.ts "TD Canada"
async function main() {
  const nameFilter = process.argv[2];
  if (!nameFilter) throw new Error('Usage: npx tsx scripts/debug-item-sync.ts "<institution name filter>"');

  const [item] = await db
    .select()
    .from(schema.plaidItems)
    .where(ilike(schema.plaidItems.institutionName, `%${nameFilter}%`))
    .limit(1);
  if (!item) throw new Error(`No plaid_items row matching "${nameFilter}"`);

  console.log("Item:", { id: item.id, institutionName: item.institutionName, status: item.status, consentedProducts: item.consentedProducts });

  if (item.institutionId) {
    // US+CA regardless of PLAID_COUNTRY_CODES — this is specifically for
    // inspecting a Canadian institution, whatever the app's own Link config is.
    const inst = await plaidClient.institutionsGetById({
      institution_id: item.institutionId,
      country_codes: ["US", "CA"] as CountryCode[],
    });
    console.log("Institution products (what it actually supports):", inst.data.institution.products);
  }

  const accessToken = await getAccessToken(item.id);

  const syncRes = await plaidClient.transactionsSync({ access_token: accessToken, cursor: item.transactionsCursor ?? undefined, count: 100 });
  console.log("transactions/sync:", {
    added: syncRes.data.added.length,
    modified: syncRes.data.modified.length,
    removed: syncRes.data.removed.length,
    has_more: syncRes.data.has_more,
    sample: syncRes.data.added.slice(0, 3).map((t) => ({ name: t.name, amount: t.amount, date: t.date, account_id: t.account_id })),
  });

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
