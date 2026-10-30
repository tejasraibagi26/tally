import { and, eq, gte, inArray, isNull, lt, lte } from "drizzle-orm";
import { db, schema } from "@/db";
import { liveAccount } from "@/lib/liveAccounts";
import { creditCardsForUser, viewForCard } from "@/lib/liabilities";
import { paychequeFor } from "@/lib/safeToSpend";
import { getUserTimezone } from "@/lib/userTimezone";
import { todayInZone } from "@tally/core/zonedDate";
import { toNetWorthCurrency } from "@tally/core/fx";
import { accountDisplayName } from "@tally/core/accountName";
import { daysBefore } from "@tally/core/overviewView";
import { countsAsCash } from "@tally/core/safeToSpend";
import {
  DEFAULT_FORECAST_DAYS,
  FORECAST_RANGES,
  NO_SPEND,
  computeForecast,
  type DailySpendProfile,
  type Forecast,
  type ForecastFrequency,
  type ForecastRange,
  type ForecastStreamInput,
} from "@tally/core/forecast";

/** How far back the day-to-day spending estimate reads. */
const SPEND_WINDOW_DAYS = 90;
/** Below this much history there is no estimate worth drawing a band around. */
const MIN_SPEND_HISTORY_DAYS = 30;
/** A counted account not synced in this long makes the whole curve "as of". */
const STALE_AFTER_MS = 24 * 60 * 60 * 1000;

export interface ForecastAssumptions {
  /** The flat daily figure the page quotes: the override, else the profile's mean. */
  dailySpendCents: number;
  source: DailySpendProfile["source"];
  /** Days of transaction history the estimate had to work with, capped at the window. */
  historyDays: number;
  paycheques: number;
  bills: number;
  /** Cards left out for want of a statement and a due day, by label. */
  cardsExcluded: string[];
  /** Counted accounts whose balance is over a day old. */
  stale: { id: string; name: string }[];
  /** An annual stream counted whole rather than spread, by label. */
  lumpy: string[];
}

export interface ForecastResult extends Forecast {
  assumptions: ForecastAssumptions;
  range: ForecastRange;
}

export function asRange(days: unknown): ForecastRange {
  const n = Number(days);
  return (FORECAST_RANGES as readonly number[]).includes(n) ? (n as ForecastRange) : DEFAULT_FORECAST_DAYS;
}

/**
 * The day-to-day spending estimate: a median per weekday over the trailing
 * window, because one sofa should not bend eight weeks of curve, and because
 * weekend-heavy spending is real — a flat rate draws a straight ramp that
 * matches nobody's life.
 *
 * Days with no spending count as zero. Taking the median of only the days a
 * person bought something would quietly inflate every week.
 */
export function spendProfile(
  rows: { date: string; amount: number }[],
  today: string,
  historyDays: number,
  override: number | null,
): DailySpendProfile {
  if (historyDays < MIN_SPEND_HISTORY_DAYS && override == null) return NO_SPEND;

  const span = Math.min(historyDays, SPEND_WINDOW_DAYS);
  const totals = new Map<string, number>();
  for (let i = 1; i <= span; i++) totals.set(daysBefore(today, i), 0);
  for (const r of rows) {
    const at = totals.get(r.date);
    if (at != null) totals.set(r.date, at + Math.abs(r.amount));
  }

  const daily = [...totals.values()];
  const mean = daily.reduce((s, v) => s + v, 0) / (daily.length || 1);
  const sd = daily.length
    ? Math.round(Math.sqrt(daily.reduce((s, v) => s + (v - mean) ** 2, 0) / daily.length))
    : 0;

  if (override != null) return { byWeekday: Array(7).fill(override), sd, source: "override" };

  const buckets: number[][] = [[], [], [], [], [], [], []];
  for (const [date, total] of totals) {
    buckets[new Date(Date.parse(`${date}T00:00:00Z`)).getUTCDay()]!.push(total);
  }
  return { byWeekday: buckets.map(median), sd, source: "weekday_median" };
}

function median(values: number[]): number {
  if (!values.length) return 0;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid]! : Math.round((s[mid - 1]! + s[mid]!) / 2);
}

export async function forecastFor(userId: string, days?: number): Promise<ForecastResult> {
  const today = todayInZone(await getUserTimezone(userId));
  const spendFrom = daysBefore(today, SPEND_WINDOW_DAYS);

  const [accountRows, [user], streamRows, cards, schedules, paycheque, spendRows, [earliest]] = await Promise.all([
    db
      .select({
        id: schema.accounts.id,
        name: schema.accounts.name,
        nickname: schema.accounts.nickname,
        mask: schema.accounts.mask,
        type: schema.accounts.type,
        subtype: schema.accounts.subtype,
        currency: schema.accounts.currency,
        countsAsCash: schema.accounts.countsAsCash,
        paymentDueDay: schema.accounts.paymentDueDay,
        currentBalance: schema.accounts.currentBalance,
        availableBalance: schema.accounts.availableBalance,
        isHidden: schema.accounts.isHidden,
        syncedAt: schema.plaidItems.lastSyncedAt,
        isManual: schema.accounts.isManual,
        balanceAsOf: schema.accounts.balanceAsOf,
      })
      .from(schema.accounts)
      .leftJoin(schema.plaidItems, eq(schema.accounts.itemId, schema.plaidItems.id))
      .where(and(eq(schema.accounts.userId, userId), inArray(schema.accounts.type, ["depository", "credit"]), liveAccount)),
    db
      .select({
        cushion: schema.users.safeToSpendCushion,
        override: schema.users.forecastDailySpendCents,
        days: schema.users.forecastDays,
      })
      .from(schema.users)
      .where(eq(schema.users.id, userId))
      .limit(1),
    db
      .select({
        id: schema.recurringStreams.id,
        description: schema.recurringStreams.description,
        merchantKey: schema.recurringStreams.merchantKey,
        averageAmount: schema.recurringStreams.averageAmount,
        frequency: schema.recurringStreams.frequency,
        predictedNextDate: schema.recurringStreams.predictedNextDate,
        manualNextDueDate: schema.recurringStreams.manualNextDueDate,
        lastDate: schema.recurringStreams.lastDate,
        status: schema.recurringStreams.status,
        accountId: schema.recurringStreams.accountId,
        isManual: schema.recurringStreams.isManual,
        amortizeMonthly: schema.recurringStreams.amortizeMonthly,
        amortizeMonths: schema.recurringStreams.amortizeMonths,
      })
      .from(schema.recurringStreams)
      .where(and(eq(schema.recurringStreams.userId, userId), isNull(schema.recurringStreams.dismissedAt))),
    creditCardsForUser(userId),
    db
      .select({
        id: schema.incomeSchedules.id,
        label: schema.incomeSchedules.label,
        amount: schema.incomeSchedules.amount,
        dayAnchors: schema.incomeSchedules.dayAnchors,
      })
      .from(schema.incomeSchedules)
      .where(and(eq(schema.incomeSchedules.userId, userId), eq(schema.incomeSchedules.active, true))),
    paychequeFor(userId, today),
    db
      .select({
        id: schema.transactions.id,
        postedDate: schema.transactions.postedDate,
        amount: schema.transactions.amount,
        currency: schema.transactions.currency,
        categoryKind: schema.categories.kind,
      })
      .from(schema.transactions)
      .leftJoin(schema.categories, eq(schema.transactions.categoryId, schema.categories.id))
      .where(
        and(
          eq(schema.transactions.userId, userId),
          eq(schema.transactions.isPending, false),
          eq(schema.transactions.isTransfer, false),
          eq(schema.transactions.excludedFromBudget, false),
          isNull(schema.transactions.incomeScheduleId),
          // Rows lib/recurringBillGeneration.ts fabricated, and the real charge
          // an amortised stream matches: both are bills, already projected as
          // streams. Counting them here would charge every one of them twice.
          isNull(schema.transactions.recurringStreamId),
          lt(schema.transactions.amount, 0),
          gte(schema.transactions.postedDate, spendFrom),
          lte(schema.transactions.postedDate, today),
        ),
      ),
    db
      .select({ postedDate: schema.transactions.postedDate })
      .from(schema.transactions)
      .where(eq(schema.transactions.userId, userId))
      .orderBy(schema.transactions.postedDate)
      .limit(1),
  ]);

  const currencyOf = new Map(accountRows.map((a) => [a.id, a.currency]));
  const dueDayOf = new Map(accountRows.map((a) => [a.id, a.paymentDueDay]));
  const label = (a: { name: string; nickname: string | null; mask: string | null }) =>
    accountDisplayName(a.name, a.nickname) + (a.mask ? ` ····${a.mask}` : "");

  const visible = accountRows.filter((a) => !a.isHidden);
  const accounts = await Promise.all(
    visible.map(async (a) => ({
      id: a.id,
      name: label(a),
      type: a.type,
      subtype: a.subtype,
      countsAsCash: a.countsAsCash,
      balance: await toNetWorthCurrency(a.availableBalance ?? a.currentBalance ?? 0, a.currency),
      // A manual account has no sync: its balance is as fresh as its last edit.
      syncedAt: (a.isManual ? a.balanceAsOf : a.syncedAt)?.toISOString() ?? null,
    })),
  );

  const streams: ForecastStreamInput[] = await Promise.all(
    streamRows.map(async (s) => ({
      id: s.id,
      label: s.description ?? s.merchantKey,
      averageAmount: await toNetWorthCurrency(s.averageAmount, (s.accountId && currencyOf.get(s.accountId)) || "CAD"),
      frequency: s.frequency as ForecastFrequency,
      predictedNextDate: s.predictedNextDate,
      manualNextDueDate: s.manualNextDueDate,
      lastDate: s.lastDate,
      status: s.status,
      isManual: s.isManual,
      accountId: s.accountId,
      amortizeMonthly: s.amortizeMonthly,
      amortizeMonths: s.amortizeMonths,
    })),
  );

  const cardInputs = await Promise.all(
    cards.map(async (c) => {
      const view = viewForCard(c, today);
      return {
        accountId: c.accountId,
        label: label(c),
        left: view.left == null ? null : await toNetWorthCurrency(view.left, c.currency),
        dueDate: c.liability?.nextPaymentDueDate ?? null,
        dueDay: dueDayOf.get(c.accountId) ?? null,
      };
    }),
  );

  const incomes = await Promise.all(
    schedules.map(async (s) => ({
      id: s.id,
      label: s.label,
      amount: await toNetWorthCurrency(s.amount, "CAD"),
      dayAnchors: s.dayAnchors,
    })),
  );

  const spendable = spendRows.filter((r) => r.categoryKind == null || r.categoryKind === "expense");
  const spendDaily = await Promise.all(
    spendable.map(async (r) => ({ date: r.postedDate, amount: await toNetWorthCurrency(r.amount, r.currency) })),
  );

  const first = earliest?.postedDate ?? today;
  const historyDays = Math.max(
    0,
    Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${first}T00:00:00Z`)) / 86_400_000),
  );
  const spend = spendProfile(spendDaily, today, historyDays, user?.override ?? null);

  const range = asRange(days ?? user?.days ?? DEFAULT_FORECAST_DAYS);
  const forecast = computeForecast({
    accounts,
    streams,
    cards: cardInputs,
    incomes,
    paycheque: paycheque?.confident
      ? { label: paycheque.label, amount: paycheque.amount, cadence: paycheque.cadence, nextDate: paycheque.nextDate, lastDate: paycheque.lastDate }
      : null,
    spend,
    cushion: user?.cushion ?? 0,
    today,
    days: range,
  });

  const nowMs = Date.now();
  const assumptions: ForecastAssumptions = {
    dailySpendCents: spend.byWeekday.length
      ? Math.round(spend.byWeekday.reduce((s, v) => s + v, 0) / 7)
      : 0,
    source: spend.source,
    historyDays: Math.min(historyDays, SPEND_WINDOW_DAYS),
    paycheques: forecast.events.filter((e) => e.kind === "income").length,
    bills: new Set(forecast.events.filter((e) => e.kind === "bill").map((e) => e.sourceId)).size,
    cardsExcluded: cardInputs.filter((c) => !c.dueDate && c.dueDay == null).map((c) => c.label),
    stale: accounts
      .filter(countsAsCash)
      .filter((a) => a.syncedAt == null || nowMs - Date.parse(a.syncedAt) > STALE_AFTER_MS)
      .map((a) => ({ id: a.id, name: a.name })),
    lumpy: streams.filter((s) => s.amortizeMonthly).map((s) => s.label),
  };

  return { ...forecast, assumptions, range };
}
