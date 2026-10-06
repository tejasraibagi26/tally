/**
 * How a credit card reads in both apps (Credit cards, Upcoming, Overview):
 * which transactions are payments, how much of the last statement is paid,
 * the cycle state and its due label, what's still owed, utilization tone,
 * the next payment across cards, and the card's network from its name.
 * Pure -- callers pass already-loaded fields; "today" is YYYY-MM-DD in the
 * user's zone, so nothing here reads the clock. Cents throughout; a card's
 * balance is positive when owed, and transaction amounts are positive for
 * money in (a payment into the card).
 */

import { CREDIT_UTILIZATION_LIMIT } from "./overviewView";

const DAY_MS = 86_400_000;

function dayDiff(from: string, to: string): number {
  return Math.round((new Date(`${to}T00:00:00Z`).getTime() - new Date(`${from}T00:00:00Z`).getTime()) / DAY_MS);
}

/** Days before a due date that a card counts as due soon (amber). */
export const DUE_SOON_DAYS = 3;

export interface PaymentCandidate {
  /** Cents; positive is money into the card. */
  amount: number;
  isTransfer: boolean;
  pfcPrimary: string | null;
  pfcDetailed: string | null;
  /** Kind of the category it's filed under, if any (expense/income/transfer). */
  categoryKind: string | null;
}

/**
 * Whether a transaction on a card account is a payment toward it: money in,
 * tagged by Plaid as a card payment or a transfer in, or marked a transfer.
 * A refund is money in too but isn't a payment, so money in filed under an
 * expense category (and not tagged as a payment) is left out.
 */
export function isCardPayment(t: PaymentCandidate): boolean {
  if (t.amount <= 0) return false;
  if (t.pfcDetailed === "LOAN_PAYMENTS_CREDIT_CARD_PAYMENT") return true;
  if (t.categoryKind === "expense") return false;
  return t.pfcPrimary === "TRANSFER_IN" || t.pfcPrimary === "LOAN_PAYMENTS" || t.isTransfer;
}

export interface CardInput {
  /** Cents; positive is owed, negative is a credit. */
  currentBalance: number;
  creditLimit: number | null;
  statementBalance: number | null;
  /** lastStatementIssueDate, YYYY-MM-DD. */
  statementDate: string | null;
  minimum: number | null;
  dueDate: string | null;
  /** The bank's own past-due flag. */
  isOverdue: boolean;
  /** The bank's last payment record (it lags about a day). */
  lastPaymentAmount: number | null;
  lastPaymentDate: string | null;
  /** Sum of payment transactions (isCardPayment) posted on or after statementDate. */
  paidFromTransactions: number;
}

export type CycleState = "paid" | "due" | "dueSoon" | "overdue" | "noStatement";
export type UtilizationTone = "healthy" | "high" | "over" | "none";

export interface CardView {
  state: CycleState;
  /** Owed nothing at all: the balance is a credit. */
  credit: boolean;
  /** Paid toward the last statement since it closed: the larger of transactions and the bank's record. */
  paid: number;
  /** Statement balance still unpaid (null with no statement). */
  left: number | null;
  minimumMet: boolean;
  /**
   * What's due now, for Upcoming and the next-payment line: nothing if paid;
   * what's left once the minimum is covered; the rest of the minimum when
   * it isn't; the statement balance when the bank reports a $0 minimum on an
   * unpaid statement; null when there's no minimum at all ("Min. unknown").
   */
  amountDue: number | null;
  /** "Due in 2 days", "Due today", "Due tomorrow", "Due Oct 15", "Overdue · 2 days"; null when paid or unknown. */
  dueLabel: string | null;
  overdueDays: number;
  /** Balance ÷ limit; null with no limit. */
  utilization: number | null;
  utilizationTone: UtilizationTone;
}

function shortDate(date: string): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

/** Payments toward the last statement: whichever source has seen more of them. */
export function paidSinceStatement(c: Pick<CardInput, "statementDate" | "lastPaymentAmount" | "lastPaymentDate" | "paidFromTransactions">): number {
  const bank = c.statementDate && c.lastPaymentDate && c.lastPaymentDate >= c.statementDate ? Math.max(0, c.lastPaymentAmount ?? 0) : 0;
  return Math.max(c.paidFromTransactions, bank);
}

export function describeCard(c: CardInput, today: string): CardView {
  const utilization = c.creditLimit && c.creditLimit > 0 ? c.currentBalance / c.creditLimit : null;
  const utilizationTone: UtilizationTone =
    utilization == null ? "none" : utilization > 1 ? "over" : utilization >= CREDIT_UTILIZATION_LIMIT ? "high" : "healthy";
  const paid = paidSinceStatement(c);
  const credit = c.currentBalance <= 0;
  const hasStatement = c.statementBalance != null && c.statementDate != null;
  const left = hasStatement ? Math.max(0, c.statementBalance! - paid) : null;
  const minimumMet = c.minimum == null ? false : paid >= c.minimum;
  const base = { credit, paid, left, minimumMet, utilization, utilizationTone };

  // Nothing owed on this statement, or nothing owed at all.
  if (credit || (hasStatement && left === 0)) {
    return { ...base, state: "paid", left: hasStatement ? 0 : null, amountDue: null, dueLabel: null, overdueDays: 0 };
  }

  let amountDue: number | null;
  if (c.minimum == null) amountDue = null;
  else if (c.minimum === 0) amountDue = left;
  else if (minimumMet) amountDue = left;
  else amountDue = c.minimum - paid;

  if (!hasStatement && !c.isOverdue) {
    return { ...base, state: "noStatement", amountDue: null, dueLabel: null, overdueDays: 0 };
  }

  const n = c.dueDate ? dayDiff(today, c.dueDate) : null;
  // The bank's flag, or the date has passed with the minimum still unpaid.
  const overdue = c.isOverdue || (n != null && n < 0 && !minimumMet);
  if (overdue) {
    const days = n != null && n < 0 ? -n : 0;
    return { ...base, state: "overdue", amountDue, dueLabel: days > 0 ? `Overdue · ${days} day${days === 1 ? "" : "s"}` : "Overdue", overdueDays: days };
  }
  if (n == null) return { ...base, state: "due", amountDue, dueLabel: null, overdueDays: 0 };
  // Past the date with the minimum covered: not overdue, but the rest is still owed.
  if (n < 0) return { ...base, state: "due", amountDue, dueLabel: `Was due ${shortDate(c.dueDate!)}`, overdueDays: 0 };
  const dueLabel = n <= 0 ? "Due today" : n === 1 ? "Due tomorrow" : n <= DUE_SOON_DAYS ? `Due in ${n} days` : `Due ${shortDate(c.dueDate!)}`;
  return { ...base, state: n <= DUE_SOON_DAYS ? "dueSoon" : "due", amountDue, dueLabel, overdueDays: 0 };
}

/** Sort order for a card list: overdue, due soon, due (by date), no statement, paid. */
export function cardSortRank(v: Pick<CardView, "state">): number {
  return { overdue: 0, dueSoon: 1, due: 2, noStatement: 3, paid: 4 }[v.state];
}

/**
 * The one payment the page leads with: the most urgent unpaid statement
 * (overdue first, then the soonest due date). Null when every statement is
 * paid or none has a due date.
 */
export function nextPayment<T extends { view: CardView; dueDate: string | null }>(cards: T[]): T | null {
  const open = cards.filter((c) => c.view.state === "overdue" || ((c.view.state === "due" || c.view.state === "dueSoon") && c.dueDate));
  open.sort((a, b) => cardSortRank(a.view) - cardSortRank(b.view) || (a.dueDate ?? "").localeCompare(b.dueDate ?? ""));
  return open[0] ?? null;
}

export type CardNetwork = "visa" | "mastercard" | "amex";

/**
 * A card's network from its names, since Plaid doesn't report one. Matches
 * whole words, official name first. Two different networks named at once
 * means unknown -- never a guess. Amex issues its own cards, so the
 * institution name counts for it.
 */
export function cardNetwork(officialName: string | null | undefined, name: string | null | undefined, institutionName?: string | null): CardNetwork | null {
  function match(text: string | null | undefined): CardNetwork | null {
    if (!text) return null;
    const t = ` ${text.toLowerCase().replace(/[^a-z0-9]+/g, " ")} `;
    const found = new Set<CardNetwork>();
    if (/ visa /.test(t)) found.add("visa");
    if (/ (mastercard|master card|world elite|mc) /.test(t)) found.add("mastercard");
    if (/ (amex|american express) /.test(t)) found.add("amex");
    return found.size === 1 ? [...found][0]! : null;
  }
  return match(officialName) ?? match(name) ?? (match(institutionName) === "amex" ? "amex" : null);
}

/** "#RRGGBB" → whether white marks read on it (contrast ≥ 3:1). Unknown colors count as light. */
export function isDarkBrandColor(hex: string | null | undefined): boolean {
  const m = hex?.trim().match(/^#?([0-9a-f]{6})$/i);
  if (!m) return false;
  const n = parseInt(m[1]!, 16);
  const lin = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  const l = 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
  return 1.05 / (l + 0.05) >= 3;
}
