import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { computeUtilization, type CreditAccountLike, type UtilizationResult } from "@tally/core/portfolioMath";

export interface CreditCardRow {
  accountId: string;
  name: string;
  mask: string | null;
  currentBalance: number;
  creditLimit: number | null;
  creditLimitIsManual: boolean;
  liability: {
    aprs: unknown;
    isOverdue: boolean;
    lastPaymentAmount: number | null;
    lastPaymentDate: string | null;
    lastStatementBalance: number | null;
    lastStatementIssueDate: string | null;
    minimumPaymentAmount: number | null;
    nextPaymentDueDate: string | null;
    asOf: Date | null;
  } | null;
}

export async function creditCardsForUser(userId: string): Promise<CreditCardRow[]> {
  const rows = await db
    .select({
      accountId: schema.accounts.id,
      name: schema.accounts.name,
      mask: schema.accounts.mask,
      currentBalance: schema.accounts.currentBalance,
      creditLimit: schema.accounts.creditLimit,
      creditLimitIsManual: schema.accounts.creditLimitIsManual,
      liability: schema.liabilitiesCredit,
    })
    .from(schema.accounts)
    .leftJoin(schema.liabilitiesCredit, eq(schema.liabilitiesCredit.accountId, schema.accounts.id))
    .where(and(eq(schema.accounts.userId, userId), eq(schema.accounts.type, "credit")));

  return rows.map((r) => ({
    accountId: r.accountId,
    name: r.name,
    mask: r.mask,
    currentBalance: r.currentBalance ?? 0,
    creditLimit: r.creditLimit,
    creditLimitIsManual: r.creditLimitIsManual,
    liability: r.liability,
  }));
}

export function utilizationFor(cards: CreditCardRow[]): UtilizationResult {
  const accountLikes: CreditAccountLike[] = cards.map((c) => ({ currentBalance: c.currentBalance, creditLimit: c.creditLimit }));
  return computeUtilization(accountLikes);
}
