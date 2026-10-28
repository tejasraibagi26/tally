/**
 * Safe to spend (the Safe to Spend spec): cash you can spend before the
 * next payday without missing a bill or a card payment.
 *
 *   safe = cash − bills due before payday − card payments due − cushion
 *
 * Pure: callers load accounts, bills, cards and the payday, convert money
 * to one currency, and pass "today" (YYYY-MM-DD, user's zone) and "now"
 * (an ISO instant, for staleness).
 */
import { payDatesForMonth, type DayAnchor } from "./incomeScheduleMath";
import { UPCOMING_GRACE_DAYS, daysBefore } from "./overviewView";

const DAY_MS = 86_400_000;
const STALE_AFTER_MS = 24 * 60 * 60 * 1000;

export interface CashAccountInput {
  id: string;
  name: string;
  type: string; // depository | credit | investment | loan
  subtype: string | null;
  /** The user's choice; null = the type's default (countsAsCashByDefault). */
  countsAsCash: boolean | null;
  /** Available balance when the bank gives one, else current; converted. */
  balance: number;
  syncedAt: string | null; // ISO
}

export interface BillInput {
  id: string;
  label: string;
  amount: number; // cents, positive
  dueDate: string;
  accountId: string | null;
}

export interface CardInput {
  accountId: string;
  label: string;
  /** Statement balance still unpaid (cardView's `left`); null with no statement. */
  left: number | null;
  /** The bank's next due date. */
  dueDate: string | null;
  /** The user's due day when the bank reports none: 1-31, 0 = last day. */
  dueDay: number | null;
}

export type PaydaySource = "paycheque" | "schedule" | "month_end";

export interface PaydayInput {
  date: string;
  source: PaydaySource;
  /** The payer and its typical amount, for "About $2,400 from ACME PAYROLL". */
  label?: string;
  amount?: number;
}

export interface SafeToSpend {
  amount: number;
  /** Null when short or when the window has no days. */
  perDay: number | null;
  window: { start: string; end: string; days: number };
  payday: PaydayInput;
  /** Payday is today and its money hasn't landed. */
  paydayToday: boolean;
  cash: { id: string; name: string; balance: number }[];
  /** Cash-type accounts left out (savings by default), for "TD Savings isn't counted". */
  notCounted: { id: string; name: string }[];
  cashTotal: number;
  bills: (BillInput & { overdue: boolean })[];
  billsTotal: number;
  cards: { accountId: string; label: string; amount: number; dueDate: string | null; assumed: boolean }[];
  cardsTotal: number;
  cushion: number;
  /** Counted accounts not synced in 24 hours. */
  stale: { id: string; name: string; syncedAt: string | null }[];
}

/** Checking-like accounts count; savings, CDs and money market stay separate. */
export function countsAsCashByDefault(type: string, subtype: string | null): boolean {
  if (type !== "depository") return false;
  return !["savings", "cd", "money market", "hsa", "cash management"].includes((subtype ?? "").toLowerCase());
}

export function countsAsCash(a: Pick<CashAccountInput, "type" | "subtype" | "countsAsCash">): boolean {
  if (a.type !== "depository") return false;
  return a.countsAsCash ?? countsAsCashByDefault(a.type, a.subtype);
}

function addDays(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
}

function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / DAY_MS);
}

function monthEnd(date: string): string {
  const d = new Date(Date.UTC(Number(date.slice(0, 4)), Number(date.slice(5, 7)), 0));
  return d.toISOString().slice(0, 10);
}

/** The next date at or after `today` that a due day lands on (no weekend shift: card due dates don't move). */
export function nextDueFromDay(dueDay: number, today: string): string {
  const y = Number(today.slice(0, 4));
  const m = Number(today.slice(5, 7)) - 1;
  for (let k = 0; k <= 1; k++) {
    const last = new Date(Date.UTC(y, m + k + 1, 0)).getUTCDate();
    const day = dueDay === 0 ? last : Math.min(dueDay, last);
    const d = new Date(Date.UTC(y, m + k, day)).toISOString().slice(0, 10);
    if (d >= today) return d;
  }
  return today;
}

/** The earliest pay date at or after today across income schedules' anchors. */
export function nextScheduledPayday(anchorSets: DayAnchor[][], today: string): string | null {
  const y = Number(today.slice(0, 4));
  const m = Number(today.slice(5, 7)) - 1;
  const dates: string[] = [];
  for (const anchors of anchorSets) {
    for (let k = 0; k <= 1; k++) {
      const d = new Date(Date.UTC(y, m + k, 1));
      dates.push(...payDatesForMonth(d.getUTCFullYear(), d.getUTCMonth(), anchors));
    }
  }
  return dates.filter((d) => d >= today).sort()[0] ?? null;
}

/** Payday: the detected paycheque, else the schedule, else the month's end. */
export function choosePayday(paycheque: { nextDate: string; label: string; amount: number } | null, scheduled: string | null, today: string): PaydayInput {
  if (paycheque && paycheque.nextDate >= today) return { date: paycheque.nextDate, source: "paycheque", label: paycheque.label, amount: paycheque.amount };
  if (scheduled) return { date: scheduled, source: "schedule" };
  return { date: addDays(monthEnd(today), 1), source: "month_end" };
}

export function computeSafeToSpend(input: {
  accounts: CashAccountInput[];
  bills: BillInput[];
  cards: CardInput[];
  cushion: number;
  payday: PaydayInput;
  today: string;
  now: string;
}): SafeToSpend {
  const { today, payday } = input;
  const paydayToday = payday.date === today;
  // The window ends the day before payday, or today when payday is today and hasn't landed.
  const end = paydayToday ? today : addDays(payday.date, -1);
  const days = daysBetween(today, end) + 1;

  const counted = input.accounts.filter(countsAsCash);
  const countedIds = new Set(counted.map((a) => a.id));
  const cash = counted.map((a) => ({ id: a.id, name: a.name, balance: a.balance }));
  const notCounted = input.accounts.filter((a) => a.type === "depository" && !countsAsCash(a)).map((a) => ({ id: a.id, name: a.name }));
  const cashTotal = cash.reduce((s, a) => s + a.balance, 0);

  // Only bills paid from counted cash (or with no known account) come out of it.
  // One on a credit card reaches cash later, through that card's payment; one
  // from savings never touches spending money.
  const known = new Set(input.accounts.map((a) => a.id));
  const from = daysBefore(today, UPCOMING_GRACE_DAYS);
  const bills = input.bills
    .filter((b) => b.dueDate >= from && b.dueDate <= end)
    .filter((b) => b.accountId == null || countedIds.has(b.accountId) || !known.has(b.accountId))
    .map((b) => ({ ...b, overdue: b.dueDate < today }))
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const billsTotal = bills.reduce((s, b) => s + b.amount, 0);

  const cards = input.cards
    .filter((c) => (c.left ?? 0) > 0)
    .map((c) => {
      const due = c.dueDate ?? (c.dueDay != null ? nextDueFromDay(c.dueDay, today) : null);
      return { accountId: c.accountId, label: c.label, amount: c.left!, dueDate: due, assumed: due == null };
    })
    // No due date at all: assume it's due before payday (the safe side) and say so.
    .filter((c) => c.assumed || (c.dueDate! >= from && c.dueDate! <= end))
    .sort((a, b) => (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999"));
  const cardsTotal = cards.reduce((s, c) => s + c.amount, 0);

  const amount = cashTotal - billsTotal - cardsTotal - input.cushion;
  const nowMs = Date.parse(input.now);
  const stale = counted
    .filter((a) => a.syncedAt == null || nowMs - Date.parse(a.syncedAt) > STALE_AFTER_MS)
    .map((a) => ({ id: a.id, name: a.name, syncedAt: a.syncedAt }));

  return {
    amount,
    perDay: amount > 0 && days > 0 ? Math.floor(amount / days) : null,
    window: { start: today, end, days },
    payday,
    paydayToday,
    cash,
    notCounted,
    cashTotal,
    bills,
    billsTotal,
    cards,
    cardsTotal,
    cushion: input.cushion,
    stale,
  };
}

function shortDay(date: string): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
}

/**
 * The card's line, in three parts so the date can be set bold:
 * "until payday, **Fri Nov 14** · about $27 a day". Shared by web, mobile
 * and the alert email.
 */
export function safeToSpendLine(s: SafeToSpend, formatMoney: (cents: number) => string): { before: string; emphasis: string; after: string; short: boolean } {
  const perDay = s.perDay != null ? ` · about ${formatMoney(Math.floor(s.perDay / 100) * 100)} a day` : "";
  if (s.amount < 0) {
    const when = s.payday.source === "month_end" ? "before" : "before payday,";
    return { before: `${formatMoney(-s.amount)} short ${when} `, emphasis: shortDay(s.payday.source === "month_end" ? s.window.end : s.payday.date), after: "", short: true };
  }
  if (s.paydayToday) {
    const from = s.payday.label && s.payday.amount ? ` About ${formatMoney(Math.round(s.payday.amount / 100) * 100)} from ${s.payday.label} should land today.` : "";
    return { before: "", emphasis: "Payday today.", after: from, short: false };
  }
  if (s.payday.source === "month_end") return { before: "until ", emphasis: shortDay(s.window.end), after: ` (month end)${perDay}`, short: false };
  return { before: "until payday, ", emphasis: shortDay(s.payday.date), after: perDay, short: false };
}
