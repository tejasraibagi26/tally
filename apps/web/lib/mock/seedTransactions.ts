import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { transactionsForSubtype } from "@/lib/mock/transactionFixtures";
import { toInternalAmountCents } from "@/lib/transactionSync/mapPlaidTransaction";
import { categorizeTransactions } from "@/lib/categorize";
import { detectTransfersForUser } from "@/lib/transfers";
import { detectRecurringForUser } from "@/lib/recurring";
import { computeAndStoreNetWorthSnapshot } from "@/lib/networth";
import type { SyncResult } from "@/lib/plaidSync";

function isoDate(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().slice(0, 10);
}

/**
 * Idempotent: each mock transaction gets a stable synthetic
 * plaid_transaction_id (mock-txn-<accountId>-<index>), so re-running this
 * (e.g. every "Sync now" click) inserts nothing new — same idempotency
 * contract as the real /transactions/sync path.
 */
export async function seedMockTransactionsForItem(itemId: string): Promise<SyncResult> {
  const accounts = await db.select().from(schema.accounts).where(eq(schema.accounts.itemId, itemId));

  let added = 0;
  let userId: string | null = null;
  for (const account of accounts) {
    userId = account.userId;
    const seeds = transactionsForSubtype(account.subtype ?? "");
    if (seeds.length === 0) continue;

    const rows = seeds.map((seed, index) => ({
      userId: account.userId,
      accountId: account.id,
      plaidTransactionId: `mock-txn-${account.id}-${index}`,
      isPending: seed.pending ?? false,
      amount: toInternalAmountCents(seed.amount),
      currency: "USD",
      postedDate: isoDate(seed.daysAgo),
      authorizedDate: isoDate(seed.daysAgo),
      name: seed.name,
      merchantName: seed.merchantName,
      paymentChannel: "in store",
      pfcPrimary: seed.pfcPrimary,
      pfcDetailed: seed.pfcDetailed,
      pfcConfidence: "VERY_HIGH",
      categorySource: "plaid" as const,
    }));

    const inserted = await db
      .insert(schema.transactions)
      .values(rows)
      .onConflictDoNothing({ target: schema.transactions.plaidTransactionId })
      .returning({ id: schema.transactions.id });
    added += inserted.length;

    if (inserted.length > 0) {
      await categorizeTransactions(account.userId, inserted.map((r) => r.id));
    }
  }

  if (userId && added > 0) {
    await detectTransfersForUser(userId);
    await detectRecurringForUser(userId);
  }
  if (userId) {
    await computeAndStoreNetWorthSnapshot(userId, new Date().toISOString().slice(0, 10));
  }

  return { added, modified: 0, removed: 0 };
}
