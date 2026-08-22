import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { holdingsForSubtype, investmentTransactionsForSubtype } from "@/lib/mock/investmentFixtures";

function isoDate(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().slice(0, 10);
}

/** Idempotent: securities/holdings are keyed by a stable `mock-sec-<ticker>` id and (account, security, today), so re-running just refreshes today's snapshot. */
export async function seedMockHoldingsForItem(itemId: string): Promise<void> {
  const accounts = await db.select().from(schema.accounts).where(eq(schema.accounts.itemId, itemId));
  const today = isoDate(0);

  for (const account of accounts) {
    const seeds = holdingsForSubtype(account.subtype ?? "");
    if (seeds.length === 0) continue;

    for (const seed of seeds) {
      const [security] = await db
        .insert(schema.securities)
        .values({
          plaidSecurityId: `mock-sec-${seed.ticker}`,
          ticker: seed.ticker,
          name: seed.name,
          type: seed.type,
          isCashEquivalent: seed.isCashEquivalent ?? false,
          closePrice: Math.round(seed.price * 100),
          closePriceAsOf: today,
          currency: "USD",
        })
        .onConflictDoUpdate({
          target: schema.securities.plaidSecurityId,
          set: { closePrice: Math.round(seed.price * 100), closePriceAsOf: today },
        })
        .returning();
      if (!security) continue;

      await db
        .insert(schema.holdings)
        .values({
          accountId: account.id,
          securityId: security.id,
          quantity: String(seed.quantity),
          costBasis: Math.round(seed.costBasisPerShare * seed.quantity * 100),
          institutionPrice: Math.round(seed.price * 100),
          institutionPriceAsOf: today,
          institutionValue: Math.round(seed.price * seed.quantity * 100),
          asOfDate: today,
        })
        .onConflictDoUpdate({
          target: [schema.holdings.accountId, schema.holdings.securityId, schema.holdings.asOfDate],
          set: {
            quantity: String(seed.quantity),
            institutionPrice: Math.round(seed.price * 100),
            institutionValue: Math.round(seed.price * seed.quantity * 100),
          },
        });
    }
  }
}

/** Depends on seedMockHoldingsForItem having run first — it resolves each seed's security by the same `mock-sec-<ticker>` id. */
export async function seedMockInvestmentTransactionsForItem(itemId: string): Promise<void> {
  const accounts = await db.select().from(schema.accounts).where(eq(schema.accounts.itemId, itemId));

  for (const account of accounts) {
    const seeds = investmentTransactionsForSubtype(account.subtype ?? "");
    if (seeds.length === 0) continue;

    for (const [index, seed] of seeds.entries()) {
      let securityId: string | null = null;
      if (seed.ticker) {
        const [security] = await db
          .select({ id: schema.securities.id })
          .from(schema.securities)
          .where(eq(schema.securities.plaidSecurityId, `mock-sec-${seed.ticker}`))
          .limit(1);
        securityId = security?.id ?? null;
      }

      await db
        .insert(schema.investmentTransactions)
        .values({
          accountId: account.id,
          plaidInvestmentTransactionId: `mock-invtxn-${account.id}-${index}`,
          securityId,
          date: isoDate(seed.daysAgo),
          name: seed.name,
          quantity: String(seed.quantity),
          amount: Math.round(seed.amount * 100),
          price: Math.round(seed.price * 100),
          type: seed.type,
          subtype: seed.subtype,
          currency: "USD",
        })
        .onConflictDoNothing({ target: schema.investmentTransactions.plaidInvestmentTransactionId });
    }
  }
}
