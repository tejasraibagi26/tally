import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { detectRecurringStreams, normalizeMerchantKey, type RecurringCandidate } from "@tally/core/recurringDetection";

/**
 * Re-runs recurring detection (§7.5) over the user's full non-transfer,
 * non-pending transaction history. Cheap enough to run after every sync at
 * this app's scale (hundreds–thousands of transactions); a previously
 * detected stream naturally transitions active → at_risk → cancelled on
 * later runs since its transactions remain in the candidate set.
 */
export async function detectRecurringForUser(userId: string): Promise<void> {
  const rows = await db
    .select({
      id: schema.transactions.id,
      accountId: schema.transactions.accountId,
      categoryId: schema.transactions.categoryId,
      merchantName: schema.transactions.merchantName,
      name: schema.transactions.name,
      amount: schema.transactions.amount,
      postedDate: schema.transactions.postedDate,
    })
    .from(schema.transactions)
    .where(and(eq(schema.transactions.userId, userId), eq(schema.transactions.isTransfer, false), eq(schema.transactions.isPending, false)));

  const candidates: RecurringCandidate[] = rows.map((r) => ({
    id: r.id,
    accountId: r.accountId,
    categoryId: r.categoryId,
    merchantKey: normalizeMerchantKey(r.merchantName ?? r.name),
    description: r.merchantName ?? r.name,
    amount: r.amount,
    postedDate: r.postedDate,
  }));

  const today = new Date().toISOString().slice(0, 10);
  const streams = detectRecurringStreams(candidates, today);

  for (const s of streams) {
    const values = {
      userId,
      merchantKey: s.merchantKey,
      description: s.description,
      accountId: s.accountId,
      categoryId: s.categoryId,
      averageAmount: s.averageAmount,
      frequency: s.frequency,
      lastDate: s.lastDate,
      predictedNextDate: s.predictedNextDate,
      status: s.status,
      confidence: s.confidence.toFixed(3),
      transactionIds: s.transactionIds,
    };
    await db
      .insert(schema.recurringStreams)
      .values(values)
      .onConflictDoUpdate({
        target: [schema.recurringStreams.userId, schema.recurringStreams.merchantKey, schema.recurringStreams.accountId],
        set: values,
      });
  }
}
