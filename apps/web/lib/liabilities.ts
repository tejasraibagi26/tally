import { and, eq, gt, gte, inArray } from "drizzle-orm";
import { db, schema } from "@/db";
import { toNetWorthCurrency } from "@tally/core/fx";
import { computeUtilization, type CreditAccountLike, type UtilizationResult } from "@tally/core/portfolioMath";
import { cardNetwork, describeCard, isCardPayment, type CardInput, type CardNetwork, type CardView } from "@tally/core/cardView";

export interface CreditCardRow {
  accountId: string;
  name: string;
  nickname: string | null;
  officialName: string | null;
  mask: string | null;
  /** The connection (plaid_items) behind the card, for its status and the bank's brand. */
  itemId: string | null;
  institutionId: string | null;
  institutionName: string | null;
  /** plaid_items.status: healthy | login_required | revoked | error | pending_expiration. */
  connectionStatus: string | null;
  lastSyncedAt: Date | null;
  /** Visa / Mastercard / Amex from the card's names (Plaid doesn't report it). */
  network: CardNetwork | null;
  /** Payments found in this card's transactions since its last statement closed. */
  paidFromTransactions: number;
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
      officialName: schema.accounts.officialName,
      itemId: schema.accounts.itemId,
      institutionId: schema.plaidItems.institutionId,
      institutionName: schema.plaidItems.institutionName,
      connectionStatus: schema.plaidItems.status,
      lastSyncedAt: schema.plaidItems.lastSyncedAt,
      liability: schema.liabilitiesCredit,
    })
    .from(schema.accounts)
    .leftJoin(schema.liabilitiesCredit, eq(schema.liabilitiesCredit.accountId, schema.accounts.id))
    .leftJoin(schema.plaidItems, eq(schema.accounts.itemId, schema.plaidItems.id))
    .where(and(eq(schema.accounts.userId, userId), eq(schema.accounts.type, "credit")));

  const paid = await paymentsSinceStatement(
    userId,
    rows.map((r) => ({ accountId: r.accountId, statementDate: r.liability?.lastStatementIssueDate ?? null })),
  );

  return rows.map((r) => ({
    accountId: r.accountId,
    name: r.name,
    nickname: r.nickname,
    officialName: r.officialName,
    mask: r.mask,
    itemId: r.itemId,
    institutionId: r.institutionId,
    institutionName: r.institutionName,
    connectionStatus: r.connectionStatus,
    lastSyncedAt: r.lastSyncedAt,
    network: cardNetwork(r.officialName, r.name, r.institutionName),
    paidFromTransactions: paid.get(r.accountId) ?? 0,
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

/**
 * Per card, the payments into it (isCardPayment) posted on or after its
 * last statement date -- seen with the next transaction sync, usually the
 * same day, while the bank's own last-payment record lags about a day.
 */
export async function paymentsSinceStatement(userId: string, cards: { accountId: string; statementDate: string | null }[]): Promise<Map<string, number>> {
  const withDate = cards.filter((c): c is { accountId: string; statementDate: string } => !!c.statementDate);
  const out = new Map<string, number>();
  if (withDate.length === 0) return out;
  const earliest = withDate.reduce((m, c) => (c.statementDate < m ? c.statementDate : m), withDate[0]!.statementDate);
  const since = new Map(withDate.map((c) => [c.accountId, c.statementDate]));
  const rows = await db
    .select({
      accountId: schema.transactions.accountId,
      postedDate: schema.transactions.postedDate,
      amount: schema.transactions.amount,
      isTransfer: schema.transactions.isTransfer,
      pfcPrimary: schema.transactions.pfcPrimary,
      pfcDetailed: schema.transactions.pfcDetailed,
      categoryKind: schema.categories.kind,
    })
    .from(schema.transactions)
    .leftJoin(schema.categories, eq(schema.transactions.categoryId, schema.categories.id))
    .where(
      and(
        eq(schema.transactions.userId, userId),
        inArray(schema.transactions.accountId, [...since.keys()]),
        gt(schema.transactions.amount, 0),
        gte(schema.transactions.postedDate, earliest),
      ),
    );
  for (const t of rows) {
    const from = since.get(t.accountId);
    if (!from || t.postedDate < from || !isCardPayment(t)) continue;
    out.set(t.accountId, (out.get(t.accountId) ?? 0) + t.amount);
  }
  return out;
}

/** describeCard's input for a card row. */
export function cardInput(c: CreditCardRow): CardInput {
  const l = c.liability;
  return {
    currentBalance: c.currentBalance,
    creditLimit: c.creditLimit,
    statementBalance: l?.lastStatementBalance ?? null,
    statementDate: l?.lastStatementIssueDate ?? null,
    minimum: l?.minimumPaymentAmount ?? null,
    dueDate: l?.nextPaymentDueDate ?? null,
    isOverdue: l?.isOverdue ?? false,
    lastPaymentAmount: l?.lastPaymentAmount ?? null,
    lastPaymentDate: l?.lastPaymentDate ?? null,
    paidFromTransactions: c.paidFromTransactions,
  };
}

export function viewForCard(c: CreditCardRow, today: string): CardView {
  return describeCard(cardInput(c), today);
}

export interface InstitutionBrand {
  name: string;
  /** "#RRGGBB" from Plaid, or null. */
  color: string | null;
  /** A data: URI of Plaid's PNG logo, or null. */
  logo: string | null;
}

/** Brand color and logo for each institution behind these cards, once per bank. */
export async function institutionBrands(cards: CreditCardRow[]): Promise<Record<string, InstitutionBrand>> {
  const ids = [...new Set(cards.map((c) => c.institutionId).filter((id): id is string => !!id))];
  if (ids.length === 0) return {};
  const rows = await db.select().from(schema.institutions).where(inArray(schema.institutions.id, ids));
  return Object.fromEntries(
    rows.map((r) => [
      r.id,
      {
        name: r.name,
        color: r.primaryColor && /^#?[0-9a-f]{6}$/i.test(r.primaryColor) ? (r.primaryColor.startsWith("#") ? r.primaryColor : `#${r.primaryColor}`) : null,
        logo: r.logoBase64 ? `data:image/png;base64,${r.logoBase64}` : null,
      },
    ]),
  );
}
