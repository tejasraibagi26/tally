import { and, eq, gt, gte, isNull, inArray } from "drizzle-orm";
import { db, schema } from "@/db";
import { liveAccount } from "@/lib/liveAccounts";
import { creditCardsForUser, viewForCard } from "@/lib/liabilities";
import { getUserTimezone } from "@/lib/userTimezone";
import { todayInZone } from "@tally/core/zonedDate";
import { toNetWorthCurrency } from "@tally/core/fx";
import { accountDisplayName } from "@tally/core/accountName";
import { daysBefore, qualifiesAsUpcoming, UPCOMING_GRACE_DAYS } from "@tally/core/overviewView";
import { detectPaycheques, primaryPaycheque, type Paycheque } from "@tally/core/paycheque";
import { choosePayday, computeSafeToSpend, countsAsCash, nextScheduledPayday, type SafeToSpend } from "@tally/core/safeToSpend";

/** How far back deposits are read to find a paycheque: enough for six monthly ones. */
const PAYCHEQUE_LOOKBACK_DAYS = 200;
/** Bills and cards are read this far ahead; the window never runs past a month and a bit. */
const LOOKAHEAD_DAYS = 45;

export interface SafeToSpendResult extends SafeToSpend {
  /** The detected paycheque behind payday (confident or not), for Settings' "Next paycheque". */
  paycheque: Paycheque | null;
}

/** Synced income deposits the paycheque detector reads: income-categorised, or Plaid's INCOME. */
async function incomeDeposits(userId: string, today: string) {
  const rows = await db
    .select({
      id: schema.transactions.id,
      accountId: schema.transactions.accountId,
      merchantName: schema.transactions.merchantName,
      name: schema.transactions.name,
      amount: schema.transactions.amount,
      postedDate: schema.transactions.postedDate,
      authorizedDate: schema.transactions.authorizedDate,
      pfcPrimary: schema.transactions.pfcPrimary,
      categoryKind: schema.categories.kind,
    })
    .from(schema.transactions)
    .leftJoin(schema.categories, eq(schema.transactions.categoryId, schema.categories.id))
    .where(
      and(
        eq(schema.transactions.userId, userId),
        gt(schema.transactions.amount, 0),
        eq(schema.transactions.isTransfer, false),
        eq(schema.transactions.isPending, false),
        // An income schedule's own generated paycheques aren't evidence of a real one.
        isNull(schema.transactions.incomeScheduleId),
        gte(schema.transactions.postedDate, daysBefore(today, PAYCHEQUE_LOOKBACK_DAYS)),
      ),
    );
  return rows
    .filter((r) => r.categoryKind === "income" || r.pfcPrimary === "INCOME")
    .map((r) => ({ id: r.id, accountId: r.accountId, merchantName: r.merchantName, name: r.name, amount: r.amount, date: r.authorizedDate ?? r.postedDate }));
}

/** The user's paycheque (the biggest steady one), whether or not it's confident yet. */
export async function paychequeFor(userId: string, today: string): Promise<Paycheque | null> {
  const found = detectPaycheques(await incomeDeposits(userId, today), today);
  return primaryPaycheque(found) ?? found[0] ?? null;
}

export async function safeToSpendFor(userId: string): Promise<SafeToSpendResult> {
  const today = todayInZone(await getUserTimezone(userId));
  const cutoff = daysBefore(today, -LOOKAHEAD_DAYS);

  const [accountRows, [user], streamRows, cards, schedules, paycheque] = await Promise.all([
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
    db.select({ cushion: schema.users.safeToSpendCushion }).from(schema.users).where(eq(schema.users.id, userId)).limit(1),
    db
      .select({
        id: schema.recurringStreams.id,
        description: schema.recurringStreams.description,
        merchantKey: schema.recurringStreams.merchantKey,
        averageAmount: schema.recurringStreams.averageAmount,
        predictedNextDate: schema.recurringStreams.predictedNextDate,
        manualNextDueDate: schema.recurringStreams.manualNextDueDate,
        status: schema.recurringStreams.status,
        accountId: schema.recurringStreams.accountId,
        isManual: schema.recurringStreams.isManual,
      })
      .from(schema.recurringStreams)
      .where(and(eq(schema.recurringStreams.userId, userId), isNull(schema.recurringStreams.dismissedAt))),
    creditCardsForUser(userId),
    db
      .select({ dayAnchors: schema.incomeSchedules.dayAnchors })
      .from(schema.incomeSchedules)
      .where(and(eq(schema.incomeSchedules.userId, userId), eq(schema.incomeSchedules.active, true))),
    paychequeFor(userId, today),
  ]);

  const currencyOf = new Map(accountRows.map((a) => [a.id, a.currency]));
  const dueDayOf = new Map(accountRows.map((a) => [a.id, a.paymentDueDay]));

  const accounts = await Promise.all(
    accountRows
      .filter((a) => !a.isHidden)
      .map(async (a) => ({
        id: a.id,
        name: accountDisplayName(a.name, a.nickname) + (a.mask ? ` ····${a.mask}` : ""),
        type: a.type,
        subtype: a.subtype,
        countsAsCash: a.countsAsCash,
        balance: await toNetWorthCurrency(a.availableBalance ?? a.currentBalance ?? 0, a.currency),
        // A manual account has no sync: its balance is as fresh as its last edit.
        syncedAt: (a.isManual ? a.balanceAsOf : a.syncedAt)?.toISOString() ?? null,
      })),
  );

  const from = daysBefore(today, UPCOMING_GRACE_DAYS);
  const bills = await Promise.all(
    streamRows
      .map((s) => ({ ...s, dueDate: s.manualNextDueDate ?? s.predictedNextDate }))
      .filter((s) => qualifiesAsUpcoming(s, from, cutoff))
      .map(async (s) => ({
        id: s.id,
        label: s.description ?? s.merchantKey,
        amount: await toNetWorthCurrency(Math.abs(s.averageAmount), (s.accountId && currencyOf.get(s.accountId)) || "CAD"),
        dueDate: s.dueDate!,
        accountId: s.accountId,
      })),
  );

  const cardInputs = await Promise.all(
    cards.map(async (c) => {
      const view = viewForCard(c, today);
      return {
        accountId: c.accountId,
        label: accountDisplayName(c.name, c.nickname) + (c.mask ? ` ····${c.mask}` : ""),
        left: view.left == null ? null : await toNetWorthCurrency(view.left, c.currency),
        dueDate: c.liability?.nextPaymentDueDate ?? null,
        dueDay: dueDayOf.get(c.accountId) ?? null,
      };
    }),
  );

  const scheduled = nextScheduledPayday(
    schedules.map((s) => s.dayAnchors),
    today,
  );
  const payday = choosePayday(paycheque?.confident ? paycheque : null, scheduled, today);

  const result = computeSafeToSpend({
    accounts,
    bills,
    cards: cardInputs,
    cushion: user?.cushion ?? 0,
    payday,
    today,
    now: new Date().toISOString(),
  });
  return { ...result, paycheque };
}

export interface SafeToSpendSettingsData {
  cushion: number;
  /** Bank accounts, each with whether it counts now (the user's choice or its type's default). */
  accounts: { id: string; label: string; kind: string; counts: boolean }[];
  /** Cards whose bank reports no due date, with the day the user entered (or null). */
  cards: { id: string; label: string; dueDay: number | null }[];
}

/** What Settings → Safe to spend edits, on web and mobile (GET /api/safe-to-spend/settings). */
export async function safeToSpendSettingsFor(userId: string): Promise<SafeToSpendSettingsData> {
  const [[user], rows] = await Promise.all([
    db.select({ cushion: schema.users.safeToSpendCushion }).from(schema.users).where(eq(schema.users.id, userId)).limit(1),
    db
      .select({
        id: schema.accounts.id,
        name: schema.accounts.name,
        nickname: schema.accounts.nickname,
        mask: schema.accounts.mask,
        type: schema.accounts.type,
        subtype: schema.accounts.subtype,
        countsAsCash: schema.accounts.countsAsCash,
        paymentDueDay: schema.accounts.paymentDueDay,
        reportedDue: schema.liabilitiesCredit.nextPaymentDueDate,
      })
      .from(schema.accounts)
      .leftJoin(schema.liabilitiesCredit, eq(schema.liabilitiesCredit.accountId, schema.accounts.id))
      .where(and(eq(schema.accounts.userId, userId), eq(schema.accounts.isHidden, false), liveAccount)),
  ]);
  const label = (a: (typeof rows)[number]) => accountDisplayName(a.name, a.nickname) + (a.mask ? ` ····${a.mask}` : "");
  return {
    cushion: user?.cushion ?? 0,
    accounts: rows
      .filter((a) => a.type === "depository")
      .map((a) => ({ id: a.id, label: label(a), kind: a.subtype ? a.subtype[0]!.toUpperCase() + a.subtype.slice(1) : "Bank account", counts: countsAsCash(a) })),
    cards: rows.filter((a) => a.type === "credit" && !a.reportedDue).map((a) => ({ id: a.id, label: label(a), dueDay: a.paymentDueDay })),
  };
}
