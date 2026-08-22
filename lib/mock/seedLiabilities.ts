import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { liabilityForSubtype } from "@/lib/mock/liabilityFixtures";

function isoDate(offsetDays: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

/** Idempotent: `liabilities_credit.account_id` is unique, so this always upserts the same row. */
export async function seedMockLiabilitiesForItem(itemId: string): Promise<void> {
  const accounts = await db.select().from(schema.accounts).where(eq(schema.accounts.itemId, itemId));

  for (const account of accounts) {
    const seed = liabilityForSubtype(account.subtype ?? "");
    if (!seed) continue;

    const values = {
      accountId: account.id,
      aprs: seed.aprs.map((a) => ({
        apr_percentage: a.aprPercentage,
        apr_type: a.aprType,
        balance_subject_to_apr: a.balanceSubjectToApr,
        interest_charge_amount: a.interestChargeAmount,
      })),
      isOverdue: seed.isOverdue,
      lastPaymentAmount: Math.round(seed.lastPaymentAmount * 100),
      lastPaymentDate: isoDate(-seed.lastPaymentDaysAgo),
      lastStatementBalance: Math.round(seed.lastStatementBalance * 100),
      lastStatementIssueDate: isoDate(-seed.lastStatementIssueDaysAgo),
      minimumPaymentAmount: Math.round(seed.minimumPaymentAmount * 100),
      nextPaymentDueDate: isoDate(seed.nextPaymentDueInDays),
      asOf: new Date(),
    };

    await db
      .insert(schema.liabilitiesCredit)
      .values(values)
      .onConflictDoUpdate({ target: schema.liabilitiesCredit.accountId, set: values });
  }
}
