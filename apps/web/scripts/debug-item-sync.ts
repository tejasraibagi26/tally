import "dotenv/config";
import { ilike } from "drizzle-orm";
import type { CountryCode } from "plaid";
import { db, schema } from "../db";
import { plaidClient, getAccessToken } from "../lib/plaid";

// One-off diagnostic — not wired into the app. Run against whichever
// DATABASE_URL/PLAID_* env you point it at:
//   npx tsx scripts/debug-item-sync.ts "TD Canada"
//   npx tsx scripts/debug-item-sync.ts "Wealthsimple"
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

  let products: string[] = [];
  if (item.institutionId) {
    // US+CA regardless of PLAID_COUNTRY_CODES — this is specifically for
    // inspecting a Canadian institution, whatever the app's own Link config is.
    const inst = await plaidClient.institutionsGetById({
      institution_id: item.institutionId,
      country_codes: ["US", "CA"] as CountryCode[],
    });
    products = inst.data.institution.products;
    console.log("Institution products (what it actually supports):", products);
  }

  const accessToken = await getAccessToken(item.id);

  try {
    const syncRes = await plaidClient.transactionsSync({ access_token: accessToken, cursor: item.transactionsCursor || undefined, count: 100 });
    console.log("transactions/sync:", {
      added: syncRes.data.added.length,
      modified: syncRes.data.modified.length,
      removed: syncRes.data.removed.length,
      has_more: syncRes.data.has_more,
      sample: syncRes.data.added.slice(0, 3).map((t) => ({ name: t.name, amount: t.amount, date: t.date, account_id: t.account_id })),
    });
  } catch (err) {
    console.error("transactions/sync failed:", err instanceof Error ? err.message : err);
  }

  if (products.length === 0 || products.includes("investments")) {
    try {
      const holdingsRes = await plaidClient.investmentsHoldingsGet({ access_token: accessToken });
      console.log(
        "investments/holdings/get: holdings=",
        holdingsRes.data.holdings.length,
        "securities=",
        holdingsRes.data.securities.length,
      );
      console.log(
        "raw holdings (quantity/institution_price/institution_value straight from Plaid, before any app-side math):",
        holdingsRes.data.holdings.slice(0, 10).map((h) => ({
          security_id: h.security_id,
          quantity: h.quantity,
          institution_price: h.institution_price,
          institution_price_as_of: h.institution_price_as_of,
          institution_value: h.institution_value,
        })),
      );
    } catch (err) {
      console.error("investments/holdings/get failed:", err instanceof Error ? err.message : err);
    }
  } else {
    console.log("Skipping investments/holdings/get — institution's products list doesn't include investments:", products);
  }

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
