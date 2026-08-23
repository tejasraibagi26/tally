import "dotenv/config";
import { eq } from "drizzle-orm";
import { db, schema } from "../db";
import { plaidClient } from "../lib/plaid";
import type { CountryCode } from "plaid";

/**
 * institutions.products (what an institution actually supports) is a new
 * column — every institution linked before this shipped has it empty, which
 * means the sync-skip guard in lib/plaid.ts (institutionSupportsProduct)
 * fails open for all of them until this runs once. Re-fetches
 * institutions/get_by_id for every institution already in the table and
 * fills it in. Safe to re-run.
 */
async function main() {
  const institutions = await db.select({ id: schema.institutions.id, name: schema.institutions.name }).from(schema.institutions);
  console.log(`Backfilling products for ${institutions.length} institution(s)...`);

  let updated = 0;
  for (const inst of institutions) {
    if (inst.id.startsWith("mock-")) continue;
    try {
      const res = await plaidClient.institutionsGetById({
        institution_id: inst.id,
        country_codes: ["US", "CA"] as CountryCode[],
      });
      await db.update(schema.institutions).set({ products: res.data.institution.products }).where(eq(schema.institutions.id, inst.id));
      console.log(`  ${inst.name}: ${res.data.institution.products.join(", ") || "(none)"}`);
      updated++;
    } catch (err) {
      console.error(`  ${inst.name}: failed —`, err instanceof Error ? err.message : err);
    }
  }

  console.log(`Done — ${updated}/${institutions.length} updated.`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
