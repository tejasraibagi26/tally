import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { liveAccount } from "@/lib/liveAccounts";
import { toNetWorthCurrency } from "@tally/core/fx";
import { accountDisplayName } from "@tally/core/accountName";
import type { LoanInput } from "@tally/core/loans";

/**
 * Every debt that isn't a credit card: Plaid "loan" accounts (mortgage,
 * student, auto, personal, line of credit, ...), each with the lender's
 * payment detail when Plaid has it (liabilities_loan: mortgages and student
 * loans). Balances already count against net worth (lib/networth.ts); this
 * is the list for the Loans page and the payments for Forecast and Safe to
 * spend. Hidden and disconnected accounts are left out, as everywhere else.
 */
export interface LoanRow {
  accountId: string;
  name: string;
  nickname: string | null;
  mask: string | null;
  subtype: string | null;
  institutionName: string | null;
  connectionStatus: string | null;
  lastSyncedAt: Date | null;
  /** What's owed, positive cents, in the account's own currency. */
  balance: number;
  currency: string;
  /** The user's due day for a loan whose lender reports none. */
  paymentDueDay: number | null;
  detail: {
    kind: string;
    interestRate: string | null;
    nextPaymentDueDate: string | null;
    nextPaymentAmount: number | null;
    lastPaymentAmount: number | null;
    lastPaymentDate: string | null;
    isOverdue: boolean;
    pastDueAmount: number | null;
    originationPrincipal: number | null;
    originationDate: string | null;
    payoffDate: string | null;
  } | null;
}

export async function loansForUser(userId: string): Promise<LoanRow[]> {
  const rows = await db
    .select({
      accountId: schema.accounts.id,
      name: schema.accounts.name,
      nickname: schema.accounts.nickname,
      mask: schema.accounts.mask,
      subtype: schema.accounts.subtype,
      institutionName: schema.plaidItems.institutionName,
      connectionStatus: schema.plaidItems.status,
      lastSyncedAt: schema.plaidItems.lastSyncedAt,
      balance: schema.accounts.currentBalance,
      currency: schema.accounts.currency,
      paymentDueDay: schema.accounts.paymentDueDay,
      detail: schema.liabilitiesLoan,
    })
    .from(schema.accounts)
    .leftJoin(schema.plaidItems, eq(schema.accounts.itemId, schema.plaidItems.id))
    .leftJoin(schema.liabilitiesLoan, eq(schema.liabilitiesLoan.accountId, schema.accounts.id))
    .where(and(eq(schema.accounts.userId, userId), eq(schema.accounts.type, "loan"), eq(schema.accounts.isHidden, false), liveAccount));

  return rows
    .map((r) => ({
      ...r,
      balance: Math.abs(r.balance ?? 0),
      detail: r.detail
        ? {
            kind: r.detail.kind,
            interestRate: r.detail.interestRate,
            nextPaymentDueDate: r.detail.nextPaymentDueDate,
            nextPaymentAmount: r.detail.nextPaymentAmount,
            lastPaymentAmount: r.detail.lastPaymentAmount,
            lastPaymentDate: r.detail.lastPaymentDate,
            isOverdue: r.detail.isOverdue,
            pastDueAmount: r.detail.pastDueAmount,
            originationPrincipal: r.detail.originationPrincipal,
            originationDate: r.detail.originationDate,
            payoffDate: r.detail.payoffDate,
          }
        : null,
    }))
    .sort((a, b) => b.balance - a.balance);
}

export function loanLabel(l: Pick<LoanRow, "name" | "nickname" | "mask">): string {
  return accountDisplayName(l.name, l.nickname) + (l.mask ? ` ····${l.mask}` : "");
}

/** Forecast's and Safe to spend's view of each loan: its payment in the net-worth currency, and when it's due. */
export async function loanInputsFor(userId: string, loans?: LoanRow[]): Promise<LoanInput[]> {
  const rows = loans ?? (await loansForUser(userId));
  return Promise.all(
    rows.map(async (l) => ({
      accountId: l.accountId,
      label: loanLabel(l),
      payment: l.detail?.nextPaymentAmount != null ? await toNetWorthCurrency(l.detail.nextPaymentAmount, l.currency) : null,
      dueDate: l.detail?.nextPaymentDueDate ?? null,
      dueDay: l.paymentDueDay,
    })),
  );
}
