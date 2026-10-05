import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { toNetWorthCurrency } from "@tally/core/fx";
import { computeUtilization, type CreditAccountLike, type UtilizationResult } from "@tally/core/portfolioMath";

export interface CreditCardRow {
  accountId: string;
  name: string;
  nickname: string | null;
  mask: string | null;
  currentBalance: number;
  /** The account's own currency: balance and limit are in it. */
  currency: string;
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
      nickname: schema.accounts.nickname,
      mask: schema.accounts.mask,
      currentBalance: schema.accounts.currentBalance,
      currency: schema.accounts.currency,
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
    nickname: r.nickname,
    mask: r.mask,
    currentBalance: r.currentBalance ?? 0,
    currency: r.currency,
    creditLimit: r.creditLimit,
    creditLimitIsManual: r.creditLimitIsManual,
    liability: r.liability,
  }));
}

/**
 * Overall utilization across every card with a known limit. Each card's
 * balance and limit are converted to the net-worth currency first: a USD card
 * next to a CAD card would otherwise be summed as if they were the same unit.
 * The totals in the result are in that currency.
 */
export async function utilizationFor(cards: CreditCardRow[]): Promise<UtilizationResult> {
  const accountLikes: CreditAccountLike[] = await Promise.all(
    cards.map(async (c) => ({
      currentBalance: await toNetWorthCurrency(c.currentBalance, c.currency),
      creditLimit: c.creditLimit == null ? null : await toNetWorthCurrency(c.creditLimit, c.currency),
    })),
  );
  return computeUtilization(accountLikes);
}
