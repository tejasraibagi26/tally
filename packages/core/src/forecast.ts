/**
 * Forecast (the Forecast spec): a projected cash balance for every day in the
 * next 30-90, the first day it falls under the buffer, and what put it there.
 *
 *   balance(d) = cash_today
 *              + Σ income(e)       for e.date ≤ d
 *              − Σ obligations(e)  for e.date ≤ d
 *              − discretionary(today → d)
 *
 * Safe to spend is this same sum collapsed to one point, so the two must
 * agree where they overlap:
 *
 *   forecast(firstPayday − 1, spend = none) − cushion === computeSafeToSpend().amount
 *
 * That holds by construction — the first payday is the next income event, so
 * no income term lands inside the window — and forecast.test.ts pins it.
 *
 * Pure: callers load accounts, streams, cards and income, convert money to one
 * currency, and pass "today" (YYYY-MM-DD, the user's zone).
 */
import { payDatesForMonth, resolvePayDate, type DayAnchor } from "./incomeScheduleMath";
import { UPCOMING_GRACE_DAYS, countsAsBill, daysBefore } from "./overviewView";
import { countsAsCash, nextDueFromDay, type CashAccountInput } from "./safeToSpend";
import type { PaychequeCadence } from "./paycheque";

const DAY_MS = 86_400_000;

/** Horizons the UI offers. 90 is the ceiling: past it the estimate outweighs what's known. */
export const FORECAST_RANGES = [30, 60, 90] as const;
export type ForecastRange = (typeof FORECAST_RANGES)[number];
export const DEFAULT_FORECAST_DAYS: ForecastRange = 60;

/** Half-width of the likely-range band, in standard deviations (≈ the p25-p75 interval). */
const BAND_SIGMAS = 1.15;
/** How far back causes are gathered for the headline. */
const CAUSE_WINDOW_DAYS = 7;
/** At most this many obligations are named as the cause of a dip. */
const MAX_CAUSES = 2;

/**
 * The "How it works" explainer, shared by web's modal, mobile's sheet and
 * the one-time announcement, so the page and the math never drift apart.
 */
export const FORECAST_HOW_IT_WORKS: { title: string; body: string }[] = [
  {
    title: "It starts with the cash you have",
    body: "Your chequing balance today. Savings stays out of it unless you've said it counts — you can change that in Settings.",
  },
  {
    title: "Then it adds what's scheduled",
    body: "Your pay dates, the bills Tally found in Subscriptions, and your credit card statements. Real amounts on real dates, not guesses.",
  },
  {
    title: "And subtracts what you usually spend",
    body: "A typical day for you, worked out from the last 90 days and kept separate for each day of the week, because weekends cost more. This is the one part that's an estimate, so it's drawn as a range rather than a line.",
  },
  {
    title: "The number that matters is the first dip",
    body: "Tally leads with the first day you'd drop below your buffer, not the lowest day — it's the one you can still do something about — and names what put you there.",
  },
  {
    title: "It gets more accurate the closer it is",
    body: "Tomorrow is nearly all scheduled. Two months out is mostly estimate, which is why the range widens. Nothing here is a commitment: change a bill or a pay date and the whole curve moves.",
  },
];

export type ForecastFrequency = "weekly" | "biweekly" | "monthly" | "quarterly" | "annual";

export interface ForecastStreamInput {
  id: string;
  label: string;
  /** Cents, following recurring_streams.average_amount: negative is money out. */
  averageAmount: number;
  frequency: ForecastFrequency;
  /** recurring_streams.predicted_next_date. */
  predictedNextDate: string | null;
  /** The user's override, which also vouches for the stream (see streamQualifies). */
  manualNextDueDate: string | null;
  lastDate: string | null;
  status: string;
  isManual: boolean;
  /** The account it is charged to. A credit account means it never touches cash directly. */
  accountId: string | null;
  /** recurring_streams.amortize_monthly — a Budgets fiction, never the cash event. See occurrencesFor. */
  amortizeMonthly: boolean;
  amortizeMonths: number;
}

export interface ForecastCardInput {
  accountId: string;
  label: string;
  /** The issued statement still unpaid (cardView's `left`), positive cents; null with no statement. */
  left: number | null;
  /** The bank's next due date. */
  dueDate: string | null;
  /** The user's due day when the bank reports none: 1-31, 0 = last day. */
  dueDay: number | null;
}

export interface ForecastIncomeInput {
  id: string;
  label: string;
  /** Positive cents. */
  amount: number;
  dayAnchors: DayAnchor[];
}

/** The detected paycheque, used for the series only when there is no income schedule. */
export interface ForecastPaychequeInput {
  label: string;
  amount: number;
  cadence: PaychequeCadence;
  nextDate: string;
  /**
   * The previous deposit. For a semi-monthly paycheque this is what pins the
   * two anchors: `lastDate` and `nextDate` are consecutive paydays, so their
   * days of the month *are* the schedule, and nothing has to be assumed.
   */
  lastDate: string;
}

export interface DailySpendProfile {
  /** Cents per weekday, index 0 = Sunday. Empty for "none". */
  byWeekday: number[];
  /** Daily spread of the same sample, cents. Drives the band; 0 draws no band. */
  sd: number;
  source: "weekday_median" | "override" | "none";
}

export const NO_SPEND: DailySpendProfile = { byWeekday: [], sd: 0, source: "none" };

export type ForecastEventKind = "income" | "bill" | "card";

export interface ForecastEvent {
  date: string;
  /** Signed: positive is money in. */
  amount: number;
  kind: ForecastEventKind;
  label: string;
  /** The stream, schedule or account this came from, for the drill-down. */
  sourceId: string;
  /** The amount or the date is inferred rather than issued — a card cycle past the first. */
  modelled: boolean;
  /**
   * False for a bill charged to a credit card: it reaches cash later through
   * that card's payment, so it is listed but never moves the running balance.
   */
  affectsCash: boolean;
}

export interface ForecastDay {
  date: string;
  balance: number;
  /** The likely range around `balance`; equal to it when there is no spend profile. */
  lo: number;
  hi: number;
}

export interface ForecastCause {
  label: string;
  /** Positive cents: how much went out. */
  amount: number;
}

export interface ForecastHeadline {
  /** "shortfall" names the first day under the buffer; "floor" names the lowest point. */
  kind: "shortfall" | "floor";
  date: string;
  amount: number;
  causes: ForecastCause[];
}

export interface Forecast {
  today: string;
  /** Counted cash before any of today's events. */
  openingCash: number;
  cushion: number;
  days: ForecastDay[];
  /** Every occurrence in the window, date order, cash and card-charged alike. */
  events: ForecastEvent[];
  /** Null when there is no income to project — a bills-only curve is a missing input, not a shortfall. */
  headline: ForecastHeadline | null;
  lowest: { date: string; amount: number };
  /** The band dips under the buffer though the central line does not. Never an alert. */
  bandBreach: { date: string; amount: number } | null;
  /** The first payday in the window, which is where Safe to spend's window ends. */
  firstPayday: string | null;
  moneyIn: number;
  /** Everything leaving cash: bills, card payments and the everyday estimate. */
  moneyOut: number;
  /** The modelled part of moneyOut, so the UI can say which half is a guess. */
  everydaySpend: number;
}

export interface ForecastInput {
  accounts: CashAccountInput[];
  streams: ForecastStreamInput[];
  cards: ForecastCardInput[];
  /** Active income schedules. These win over `paycheque` — they are the user's own declaration. */
  incomes: ForecastIncomeInput[];
  paycheque: ForecastPaychequeInput | null;
  spend: DailySpendProfile;
  cushion: number;
  today: string;
  days: number;
}

// ── dates ──────────────────────────────────────────────────────────────────

function addDays(date: string, n: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + n * DAY_MS).toISOString().slice(0, 10);
}

/** Adds whole months, clamping to the target month's last day (Jan 31 + 1 → Feb 28). */
function addMonths(date: string, n: number): string {
  const y = Number(date.slice(0, 4));
  const m = Number(date.slice(5, 7)) - 1;
  const d = Number(date.slice(8, 10));
  const last = new Date(Date.UTC(y, m + n + 1, 0)).getUTCDate();
  return new Date(Date.UTC(y, m + n, Math.min(d, last))).toISOString().slice(0, 10);
}

function weekday(date: string): number {
  return new Date(Date.parse(`${date}T00:00:00Z`)).getUTCDay();
}

const STEP: Record<ForecastFrequency, (d: string) => string> = {
  weekly: (d) => addDays(d, 7),
  biweekly: (d) => addDays(d, 14),
  monthly: (d) => addMonths(d, 1),
  quarterly: (d) => addMonths(d, 3),
  annual: (d) => addMonths(d, 12),
};

// ── streams ────────────────────────────────────────────────────────────────

/**
 * Whether a stream belongs in the forecast at all — `countsAsBill`, the rule
 * Upcoming applies before its single-date window check, since a forecast
 * repeats a stream rather than asking about one date.
 */
export function streamQualifies(s: ForecastStreamInput): boolean {
  return countsAsBill(s);
}

/**
 * Every date this stream lands on within the window.
 *
 * An `amortizeMonthly` stream is the trap: `averageAmount / amortizeMonths` is
 * a Budgets fiction (lib/recurringBillGeneration.ts posts it monthly so one
 * annual renewal doesn't blow a category), while the cash event is the whole
 * charge, once every `amortizeMonths` from `lastDate`. A forecast that spreads
 * it misses the exact day the money leaves, which is the point of the feature.
 */
export function occurrencesFor(s: ForecastStreamInput, from: string, to: string): string[] {
  const lumpy = s.amortizeMonthly;
  const step = lumpy ? (d: string) => addMonths(d, s.amortizeMonths) : STEP[s.frequency];
  const start =
    s.manualNextDueDate ??
    (lumpy && s.lastDate ? addMonths(s.lastDate, s.amortizeMonths) : s.predictedNextDate);
  if (!start) return [];

  const dates: string[] = [];
  let d = start;
  // A stream whose predicted date is stale (the charge hasn't synced yet) is
  // rolled forward to the grace window rather than dropped.
  let guard = 0;
  while (d < from && guard++ < 400) d = step(d);
  while (d <= to && dates.length < 400) {
    dates.push(d);
    d = step(d);
  }
  return dates;
}

// ── income ─────────────────────────────────────────────────────────────────

/**
 * A semi-monthly paycheque's two anchors, read off the pair of consecutive
 * deposits the detector found. A day that is its month's last becomes
 * anchor 0, which `resolvePayDate` already means as "the last day", so a
 * 15th-and-last schedule stays exact in a 30- and a 31-day month alike.
 *
 * Guessing the pattern instead (assuming 15-and-last) put a spurious second
 * payday the day after a real one when someone is paid on the 30th — found
 * against live data.
 */
function semiMonthlyAnchors(lastDate: string, nextDate: string): DayAnchor[] {
  const anchorOf = (date: string): DayAnchor => {
    const y = Number(date.slice(0, 4));
    const m = Number(date.slice(5, 7)) - 1;
    const day = Number(date.slice(8, 10));
    const lastOfMonth = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
    if (day === lastOfMonth) return 0;
    // A deposit whose anchor fell on a weekend lands on the Friday before it,
    // so reading the day off the deposit can be up to two days early. When a
    // canonical anchor — the 15th, or the month's last day — resolves back to
    // exactly this date, that is the real schedule.
    if (weekday(date) === 5) {
      for (const candidate of [day + 1, day + 2]) {
        if (candidate > lastOfMonth) break;
        const canonical: DayAnchor | null = candidate === 15 ? 15 : candidate === lastOfMonth ? 0 : null;
        if (canonical !== null && resolvePayDate(y, m, canonical) === date) return canonical;
      }
    }
    return day;
  };
  return [...new Set([anchorOf(lastDate), anchorOf(nextDate)])];
}

/** Cadences that advance by a fixed stride; semi-monthly uses anchors instead. */
const CADENCE_STEP: Record<Exclude<PaychequeCadence, "semimonthly">, (d: string) => string> = {
  weekly: (d) => addDays(d, 7),
  biweekly: (d) => addDays(d, 14),
  monthly: (d) => addMonths(d, 1),
};

/**
 * Pay dates across the window. Schedules win when the user has set any — they
 * carry exact anchors and `resolvePayDate`'s weekend shift. Otherwise the
 * detected paycheque is stepped by its cadence, which is a close approximation
 * of the same thing and the best available without the user's say-so.
 *
 * Irregular income — a bonus, a refund, an invoice — is never projected. One
 * bonus last March is not evidence of one next March.
 */
export function incomeEvents(input: ForecastInput, from: string, to: string): ForecastEvent[] {
  const out: ForecastEvent[] = [];
  const active = input.incomes;

  /** Every date these anchors land on inside the window, weekend shift included. */
  const byAnchors = (anchors: DayAnchor[], label: string, amount: number, sourceId: string) => {
    const start = new Date(Date.parse(`${from}T00:00:00Z`));
    const months = Math.ceil((Date.parse(`${to}T00:00:00Z`) - start.getTime()) / DAY_MS / 28) + 1;
    for (let k = 0; k <= months; k++) {
      const d = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + k, 1));
      for (const date of payDatesForMonth(d.getUTCFullYear(), d.getUTCMonth(), anchors)) {
        if (date >= from && date <= to) {
          out.push({ date, amount, kind: "income", label, sourceId, modelled: false, affectsCash: true });
        }
      }
    }
  };

  if (active.length) {
    for (const inc of active) byAnchors(inc.dayAnchors, inc.label, inc.amount, inc.id);
    return out;
  }

  const p = input.paycheque;
  if (!p) return out;
  if (p.cadence === "semimonthly") {
    byAnchors(semiMonthlyAnchors(p.lastDate, p.nextDate), p.label, p.amount, "paycheque");
    return out;
  }
  const step = CADENCE_STEP[p.cadence];
  let d = p.nextDate;
  // Every step must advance; bailing on a non-advancing one turns what would
  // be an unbounded loop into a short series rather than silent nonsense.
  while (d < from) {
    const next = step(d);
    if (next <= d) return out;
    d = next;
  }
  while (d <= to) {
    out.push({ date: d, amount: p.amount, kind: "income", label: p.label, sourceId: "paycheque", modelled: false, affectsCash: true });
    const next = step(d);
    if (next <= d) break;
    d = next;
  }
  return out;
}

// ── cards ──────────────────────────────────────────────────────────────────

/**
 * A card's payments across the window. The first cycle is known — the issued
 * statement on its real due date. Every cycle after it is modelled from the
 * charges this forecast itself routes onto the card, assumed paid in full.
 *
 * A card with no statement and no due day contributes nothing: Safe to spend's
 * "assume it's due before payday" is the safe guess over twelve days and a
 * false shortfall every cycle over sixty.
 */
export function cardEvents(
  card: ForecastCardInput,
  chargedToCard: ForecastEvent[],
  today: string,
  to: string,
  /** The grace window's start (today − UPCOMING_GRACE_DAYS). */
  from: string,
): ForecastEvent[] {
  const firstDue = card.dueDate ?? (card.dueDay != null ? nextDueFromDay(card.dueDay, today) : null);
  if (!firstDue) return [];

  const out: ForecastEvent[] = [];
  const left = card.left ?? 0;
  // The same window computeSafeToSpend uses. A statement whose due date is
  // already well past is either paid and not yet synced, or stale data — and
  // either way, dropping it onto day 0 would invent a debt. Safe to spend
  // leaves it out, so this must too or the two screens disagree.
  if (left > 0 && firstDue >= from && firstDue <= to) {
    out.push({ date: firstDue, amount: -left, kind: "card", label: `${card.label} statement`, sourceId: card.accountId, modelled: false, affectsCash: true });
  }

  let prev = firstDue;
  let due = addMonths(firstDue, 1);
  while (due <= to) {
    const charges = chargedToCard
      .filter((e) => e.date > prev && e.date <= due)
      .reduce((sum, e) => sum + Math.abs(e.amount), 0);
    if (charges > 0) {
      out.push({ date: due, amount: -charges, kind: "card", label: `${card.label} (projected)`, sourceId: card.accountId, modelled: true, affectsCash: true });
    }
    prev = due;
    due = addMonths(due, 1);
  }
  return out;
}

// ── the forecast ───────────────────────────────────────────────────────────

export function dailySpend(date: string, spend: DailySpendProfile): number {
  if (!spend.byWeekday.length) return 0;
  return spend.byWeekday[weekday(date)] ?? 0;
}

export function computeForecast(input: ForecastInput): Forecast {
  const { today, cushion, spend } = input;
  const end = addDays(today, input.days);
  // Same grace Safe to spend uses: a bill a day or two past due hasn't been
  // charged yet (detection moves the date forward once it posts), so it still
  // has to come out — it lands on day 0.
  const from = daysBefore(today, UPCOMING_GRACE_DAYS);

  const counted = input.accounts.filter(countsAsCash);
  const openingCash = counted.reduce((s, a) => s + a.balance, 0);
  const cashIds = new Set(counted.map((a) => a.id));
  const knownIds = new Set(input.accounts.map((a) => a.id));

  // Bills. One charged to an account that isn't counted cash — a credit card,
  // most often — is listed but never moves cash on its own date.
  const bills: ForecastEvent[] = [];
  for (const s of input.streams) {
    if (!streamQualifies(s)) continue;
    const toCash = s.accountId == null || cashIds.has(s.accountId) || !knownIds.has(s.accountId);
    for (const date of occurrencesFor(s, from, end)) {
      bills.push({
        date,
        amount: -Math.abs(s.averageAmount),
        kind: "bill",
        label: s.label,
        sourceId: s.id,
        modelled: false,
        affectsCash: toCash,
      });
    }
  }

  // A due day resolves forward from today; the window's lower bound is the
  // grace start, and the first cycle's charges are already in the statement.
  const cards = input.cards.flatMap((c) =>
    cardEvents(c, bills.filter((b) => !b.affectsCash && streamAccount(input.streams, b.sourceId) === c.accountId), today, end, from),
  );

  // Income starts at `today`, not at the grace window: a paycheque that
  // already landed is in the balance, and counting it again invents money.
  // The grace window exists for bills, which are money still to move.
  const events = [...incomeEvents(input, today, end), ...bills, ...cards].sort(
    (a, b) => a.date.localeCompare(b.date) || b.amount - a.amount,
  );

  // Everything in the grace window lands on day 0: it is money that still has
  // to move, and there is no earlier day to put it on.
  const byDate = new Map<string, ForecastEvent[]>();
  for (const e of events) {
    const key = e.date < today ? today : e.date;
    const list = byDate.get(key);
    if (list) list.push(e);
    else byDate.set(key, [e]);
  }

  const days: ForecastDay[] = [];
  let balance = openingCash;
  let variance = 0;
  let everydaySpend = 0;
  for (let i = 0; i <= input.days; i++) {
    const date = addDays(today, i);
    if (i > 0) {
      const spent = dailySpend(date, spend);
      balance -= spent;
      everydaySpend += spent;
      variance += spend.sd * spend.sd;
    }
    for (const e of byDate.get(date) ?? []) if (e.affectsCash) balance += e.amount;
    const band = spend.sd > 0 ? Math.round(BAND_SIGMAS * Math.sqrt(variance)) : 0;
    days.push({ date, balance, lo: balance - band, hi: balance + band });
  }

  const lowestDay = days.reduce((a, b) => (b.balance < a.balance ? b : a));
  const lowest = { date: lowestDay.date, amount: lowestDay.balance };

  const firstIncome = events.find((e) => e.kind === "income");
  const firstPayday = firstIncome?.date ?? null;

  // A curve with bills and no wages is a missing input, not a shortfall.
  const hasIncome = firstIncome != null;
  const breach = days.find((d) => d.balance < cushion);
  const headline: ForecastHeadline | null = !hasIncome
    ? null
    : breach
      ? { kind: "shortfall", date: breach.date, amount: breach.balance, causes: causesFor(events, breach.date) }
      : { kind: "floor", date: lowest.date, amount: lowest.amount, causes: causesFor(events, lowest.date) };

  const bandBreach = breach ? null : (() => {
    const b = days.find((d) => d.lo < cushion);
    return b ? { date: b.date, amount: b.lo } : null;
  })();

  const cash = events.filter((e) => e.affectsCash);
  return {
    today,
    openingCash,
    cushion,
    days,
    events,
    headline,
    lowest,
    bandBreach,
    firstPayday,
    moneyIn: cash.filter((e) => e.amount > 0).reduce((s, e) => s + e.amount, 0),
    // Everyday spending belongs here: without it "money out" wouldn't
    // reconcile with the curve it sits beside, which is worse than no figure.
    moneyOut: cash.filter((e) => e.amount < 0).reduce((s, e) => s - e.amount, 0) + everydaySpend,
    everydaySpend,
  };
}

function streamAccount(streams: ForecastStreamInput[], id: string): string | null {
  return streams.find((s) => s.id === id)?.accountId ?? null;
}

/**
 * The one or two biggest things that went out in the week before a low point.
 * "You're short on the 12th" is an alarm; "your Amex statement is due the day
 * before payday" is something a person can act on.
 */
export function causesFor(events: ForecastEvent[], date: string): ForecastCause[] {
  const from = daysBefore(date, CAUSE_WINDOW_DAYS);
  return events
    .filter((e) => e.affectsCash && e.amount < 0 && e.date > from && e.date <= date)
    .sort((a, b) => a.amount - b.amount)
    .slice(0, MAX_CAUSES)
    .map((e) => ({ label: e.label, amount: -e.amount }));
}
