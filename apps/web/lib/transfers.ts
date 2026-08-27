import { randomUUID } from "node:crypto";
import { and, eq, inArray, ne } from "drizzle-orm";
import { db, schema } from "@/db";
import { findTransferPairs } from "@tally/core/transferDetection";

/**
 * Runs transfer pairing (WORK.md §7.4) over every not-yet-paired transaction
 * the user owns and commits any pairs found. Excludes `category_source =
 * 'manual'` rows — a transaction a human has explicitly categorized is an
 * assertion "this is real spend", not a transfer, and auto-pairing would
 * silently pull it out of their categorization. Known simplification: this
 * auto-applies pairs rather than surfacing a review queue first, since §12's
 * M4 acceptance criterion requires a card payment to already be excluded
 * from spend on both sides, not merely suggested.
 */
export async function detectTransfersForUser(userId: string): Promise<number> {
  const candidates = await db
    .select({
      id: schema.transactions.id,
      accountId: schema.transactions.accountId,
      amount: schema.transactions.amount,
      postedDate: schema.transactions.postedDate,
    })
    .from(schema.transactions)
    .where(
      and(
        eq(schema.transactions.userId, userId),
        eq(schema.transactions.isTransfer, false),
        ne(schema.transactions.categorySource, "manual"),
      ),
    );

  const pairs = findTransferPairs(candidates);

  for (const pair of pairs) {
    const groupId = randomUUID();
    await db
      .update(schema.transactions)
      .set({ isTransfer: true, transferGroupId: groupId })
      .where(inArray(schema.transactions.id, [pair.a.id, pair.b.id]));
  }

  return pairs.length;
}
