import "dotenv/config";
import { and, eq, ilike, sql } from "drizzle-orm";
import { db, schema } from "../db";

// One-off diagnostic — not wired into the app, read-only, DB only (needs
// just DATABASE_URL). Prints each holding in the latest snapshot next to its
// security's own Plaid-reported price/currency, to pin down which label a
// mis-converted holding got its currency from in reconcileHoldings
// (lib/plaidInvestments.ts): when the stored price equals the security's
// close price and the currencies match, the $0-institution-price fallback
// was taken and the currency came from the security, not the holding.
//   npx tsx scripts/debug-holdings-currency.ts "Wealthsimple"
async function main() {
  const nameFilter = process.argv[2];
  if (!nameFilter) throw new Error('Usage: npx tsx scripts/debug-holdings-currency.ts "<institution name filter>"');

  const latest = sql`(select max(h2.as_of_date) from holdings h2 where h2.account_id = ${schema.holdings.accountId})`;
  const rows = await db
    .select({
      account: schema.accounts.name,
      accountCurrency: schema.accounts.currency,
      ticker: schema.securities.ticker,
      quantity: schema.holdings.quantity,
      storedPrice: schema.holdings.institutionPrice,
      storedValue: schema.holdings.institutionValue,
      storedCurrency: schema.holdings.currency,
      securityClosePrice: schema.securities.closePrice,
      securityCurrency: schema.securities.currency,
      asOf: schema.holdings.asOfDate,
    })
    .from(schema.holdings)
    .innerJoin(schema.accounts, eq(schema.holdings.accountId, schema.accounts.id))
    .innerJoin(schema.plaidItems, eq(schema.accounts.itemId, schema.plaidItems.id))
    .innerJoin(schema.securities, eq(schema.holdings.securityId, schema.securities.id))
    .where(and(ilike(schema.plaidItems.institutionName, `%${nameFilter}%`), eq(schema.holdings.asOfDate, latest)))
    .orderBy(schema.accounts.name, schema.securities.ticker);

  for (const r of rows) {
    console.log({
      account: `${r.account} (${r.accountCurrency})`,
      ticker: r.ticker,
      quantity: r.quantity,
      stored: { price: r.storedPrice != null ? r.storedPrice / 100 : null, value: r.storedValue / 100, currency: r.storedCurrency },
      security: { closePrice: r.securityClosePrice != null ? r.securityClosePrice / 100 : null, currency: r.securityCurrency },
      likelyFallback: r.storedPrice != null && r.storedPrice === r.securityClosePrice && r.storedCurrency === r.securityCurrency,
      asOf: r.asOf,
    });
  }
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
