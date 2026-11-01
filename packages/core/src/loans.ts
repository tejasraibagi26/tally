import { nextDueFromDay } from "./safeToSpend";

/**
 * Loan payments (mortgage, student, or any loan with a known payment) for
 * Forecast and Safe to spend. Pure: callers load the loan accounts and the
 * lender's detail (liabilities_loan) and convert money first.
 *
 * A loan's balance already counts against net worth; this is only about
 * when its payment leaves cash. Recurring detection never sees most loan
 * payments -- a chequing debit paired with the loan's credit is a transfer,
 * and transfers are skipped -- so without this a mortgage is invisible to
 * both screens. Where a payment did get detected as a bill (the loan isn't
 * linked, or the pair didn't match), the bill already covers it and the
 * loan steps aside (duplicatesBill).
 */
export interface LoanInput {
  accountId: string;
  label: string;
  /** The next payment, positive cents (a mortgage's monthly payment, a student loan's minimum); null when unknown. */
  payment: number | null;
  /** The lender's next due date. */
  dueDate: string | null;
  /** The user's due day when the lender reports none: 1-31, 0 = last day. */
  dueDay: number | null;
}

export interface LoanPayment {
  accountId: string;
  label: string;
  /** Positive cents. */
  amount: number;
  date: string;
  /** The date is inferred (a later month, or from the user's due day) rather than the lender's. */
  modelled: boolean;
}

/** Adds whole months, clamping to the target month's last day (Jan 31 + 1 → Feb 28). */
function addMonths(date: string, n: number): string {
  const y = Number(date.slice(0, 4));
  const m = Number(date.slice(5, 7)) - 1;
  const d = Number(date.slice(8, 10));
  const last = new Date(Date.UTC(y, m + n + 1, 0)).getUTCDate();
  return new Date(Date.UTC(y, m + n, Math.min(d, last))).toISOString().slice(0, 10);
}

/**
 * A loan's monthly payments from `from` (the grace window's start) to `to`.
 * A lender date older than `from` is last cycle's -- the payment went out and
 * the lender hasn't reported the next one yet -- so it rolls forward a month
 * at a time rather than landing on day 0 as a debt that was already paid.
 */
export function loanPayments(loan: LoanInput, today: string, from: string, to: string): LoanPayment[] {
  if (loan.payment == null || loan.payment <= 0) return [];
  const anchor = loan.dueDate ?? (loan.dueDay != null ? nextDueFromDay(loan.dueDay, today) : null);
  if (!anchor) return [];

  let i = 0;
  while (addMonths(anchor, i) < from && i < 24) i++;
  const out: LoanPayment[] = [];
  for (let date = addMonths(anchor, i); date <= to; date = addMonths(anchor, ++i)) {
    out.push({ accountId: loan.accountId, label: loan.label, amount: loan.payment, date, modelled: loan.dueDate == null || i > 0 });
  }
  return out;
}

const MATCH_DAYS = 6;

function daysApart(a: string, b: string): number {
  return Math.abs(Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / 86_400_000;
}

/**
 * Whether a detected bill already is this payment: within 5% (or $5) of the
 * amount and within six days of the date. Then the bill stays and the loan
 * adds nothing, so the same mortgage is never subtracted twice.
 */
export function duplicatesBill(payment: { amount: number; date: string }, bills: { amount: number; date: string }[]): boolean {
  const tolerance = Math.max(500, Math.round(payment.amount * 0.05));
  return bills.some((b) => Math.abs(Math.abs(b.amount) - payment.amount) <= tolerance && daysApart(b.date, payment.date) <= MATCH_DAYS);
}

/** Every loan's payments in the window, minus any loan a detected bill already stands for. */
export function loanPaymentsBesideBills(
  loans: LoanInput[],
  bills: { amount: number; date: string }[],
  today: string,
  from: string,
  to: string,
): LoanPayment[] {
  return loans.flatMap((loan) => {
    const payments = loanPayments(loan, today, from, to);
    return payments.some((p) => duplicatesBill(p, bills)) ? [] : payments;
  });
}
