import "dotenv/config";
import { and, eq, inArray } from "drizzle-orm";
import { db, schema } from "../db";

// One-off backfill for holdings mislabeled USD before reconcileHoldings
// (lib/plaidInvestments.ts) resolved market-price currencies from the
// listing exchange: a CAD-priced security (e.g. VFV on the TSX) stored with
// currency "USD", which lib/portfolio.ts then FX-converted a second time.
// Targets rows whose security is itself recorded as CAD but whose holding
// row says USD. Dry run by default; pass --apply to write. Needs only
// DATABASE_URL:
//   npx tsx scripts/fix-holdings-currency.ts
//   npx tsx scripts/fix-holdings-currency.ts --apply
async function main() {
  const apply = process.argv.includes("--apply");

  const rows = await db
    .select({
      id: schema.holdings.id,
      account: schema.accounts.name,
      ticker: schema.securities.ticker,
      asOf: schema.holdings.asOfDate,
      value: schema.holdings.institutionValue,
    })
    .from(schema.holdings)
    .innerJoin(schema.accounts, eq(schema.holdings.accountId, schema.accounts.id))
    .innerJoin(schema.securities, eq(schema.holdings.securityId, schema.securities.id))
    .where(and(eq(schema.holdings.currency, "USD"), eq(schema.securities.currency, "CAD")))
    .orderBy(schema.securities.ticker, schema.holdings.asOfDate);

  for (const r of rows) console.log(`${r.asOf}  ${r.account}  ${r.ticker}  ${(r.value / 100).toFixed(2)}  USD -> CAD`);
  console.log(`\n${rows.length} row(s) ${apply ? "updating" : "would be updated (dry run; pass --apply to write)"}`);

  if (apply && rows.length > 0) {
    await db.update(schema.holdings).set({ currency: "CAD" }).where(inArray(schema.holdings.id, rows.map((r) => r.id)));
    console.log("Done.");
  }
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
