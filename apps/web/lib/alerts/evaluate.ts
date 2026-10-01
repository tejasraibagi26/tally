import { and, eq, gte, inArray, isNull, ne } from "drizzle-orm";
import { db, schema } from "@/db";
import {
  budgetAlerts,
  connectionAlerts,
  largeTransactionAlerts,
  subscriptionAlerts,
  type AlertCandidate,
  type StreamInput,
} from "@tally/core/alerts";
import { normalizeMerchantKey } from "@tally/core/recurringDetection";
import { getBudgetsForMonth } from "@/lib/budgets";
import { todayFor } from "@/lib/userTimezone";
import { loadAlertPreferences } from "@/lib/alerts/preferences";
import { recordAndDeliver } from "@/lib/alerts/engine";

const HISTORY_DAYS = 183; // ~6 months, ALERTS.md §4.3

function accountLabel(a: { name: string; mask: string | null }): string {
  return a.mask ? `${a.name} ····${a.mask}` : a.name;
}

async function budgetCandidates(userId: string): Promise<AlertCandidate[]> {
  const today = await todayFor(userId);
  const month = today.slice(0, 7) + "-01";
  const [y, m, d] = today.split("-").map(Number) as [number, number, number];
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const budgets = await getBudgetsForMonth(userId, month);
  return budgetAlerts(
    budgets.map((b) => ({ categoryId: b.categoryId, categoryName: b.categoryName, limit: b.amount + b.rolloverFromPrior, spend: b.spend })),
    month,
    daysInMonth - d,
  );
}

async function subscriptionCandidates(userId: string): Promise<AlertCandidate[]> {
  const streams = await db
    .select()
    .from(schema.recurringStreams)
    .where(
      and(
        eq(schema.recurringStreams.userId, userId),
        isNull(schema.recurringStreams.dismissedAt),
        eq(schema.recurringStreams.isManual, false),
        ne(schema.recurringStreams.status, "cancelled"),
      ),
    );
  const ids = streams.flatMap((s) => s.transactionIds);
  const charges = ids.length
    ? await db
        .select({ id: schema.transactions.id, amount: schema.transactions.amount, date: schema.transactions.postedDate })
        .from(schema.transactions)
        .where(inArray(schema.transactions.id, ids))
    : [];
  const byId = new Map(charges.map((c) => [c.id, c]));
  const inputs: StreamInput[] = streams.map((s) => ({
    id: s.id,
    description: s.description ?? s.merchantKey,
    frequency: s.frequency,
    charges: s.transactionIds
      .map((id) => byId.get(id))
      .filter((c): c is NonNullable<typeof c> => !!c)
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((c) => ({ amount: c.amount, date: c.date })),
  }));
  return subscriptionAlerts(inputs, await todayFor(userId));
}

async function connectionCandidates(userId: string): Promise<AlertCandidate[]> {
  const items = await db
    .select({
      id: schema.plaidItems.id,
      institutionName: schema.plaidItems.institutionName,
      status: schema.plaidItems.status,
      lastSyncedAt: schema.plaidItems.lastSyncedAt,
    })
    .from(schema.plaidItems)
    .where(eq(schema.plaidItems.userId, userId));
  return connectionAlerts(items);
}

/**
 * After a transaction sync (lib/plaidSync.ts), once categorization, transfer
 * and recurring detection have run on the new rows: large purchases among
 * them, budget steps, and subscription changes.
 */
export async function evaluateAfterTransactionSync(userId: string, plaidTransactionIds: string[]): Promise<number> {
  const { prefs } = await loadAlertPreferences(userId);
  const candidates: AlertCandidate[] = [];

  if (plaidTransactionIds.length > 0) {
    const fresh = await db
      .select({
        id: schema.transactions.id,
        plaidTransactionId: schema.transactions.plaidTransactionId,
        pendingTransactionId: schema.transactions.pendingTransactionId,
        amount: schema.transactions.amount,
        postedDate: schema.transactions.postedDate,
        isTransfer: schema.transactions.isTransfer,
        name: schema.transactions.name,
        merchantName: schema.transactions.merchantName,
        accountName: schema.accounts.name,
        accountMask: schema.accounts.mask,
      })
      .from(schema.transactions)
      .innerJoin(schema.accounts, eq(schema.accounts.id, schema.transactions.accountId))
      .where(and(eq(schema.transactions.userId, userId), inArray(schema.transactions.plaidTransactionId, plaidTransactionIds)));

    const freshIds = new Set(fresh.map((t) => t.id));
    const since = new Date(Date.now() - HISTORY_DAYS * 86_400_000).toISOString().slice(0, 10);
    const past = await db
      .select({ id: schema.transactions.id, amount: schema.transactions.amount, name: schema.transactions.name, merchantName: schema.transactions.merchantName })
      .from(schema.transactions)
      .where(and(eq(schema.transactions.userId, userId), eq(schema.transactions.isTransfer, false), gte(schema.transactions.postedDate, since)));
    const history = new Map<string, number[]>();
    for (const p of past) {
      if (p.amount >= 0 || freshIds.has(p.id)) continue;
      const key = normalizeMerchantKey(p.merchantName ?? p.name);
      history.set(key, [...(history.get(key) ?? []), -p.amount]);
    }

    candidates.push(
      ...largeTransactionAlerts(
        fresh.map((t) => ({
          id: t.id,
          plaidTransactionId: t.plaidTransactionId,
          pendingTransactionId: t.pendingTransactionId,
          amount: t.amount,
          date: t.postedDate,
          isTransfer: t.isTransfer,
          merchantKey: normalizeMerchantKey(t.merchantName ?? t.name),
          merchantLabel: t.merchantName ?? t.name,
          accountLabel: accountLabel({ name: t.accountName, mask: t.accountMask }),
        })),
        history,
        prefs.largeTransactionCents,
        await todayFor(userId),
      ),
    );
  }

  candidates.push(...(await budgetCandidates(userId)), ...(await subscriptionCandidates(userId)));
  return recordAndDeliver(userId, candidates, prefs);
}

/** After a webhook changes a connection's status. */
export async function evaluateConnections(userId: string): Promise<number> {
  return recordAndDeliver(userId, await connectionCandidates(userId));
}

/**
 * Daily sweep (ALERTS.md §3): connections, plus budget steps reached by
 * transactions that didn't come through a sync (manual entries, Shortcuts,
 * recategorizing), and subscription changes.
 */
export async function evaluateUserSweep(userId: string): Promise<number> {
  const candidates = [
    ...(await connectionCandidates(userId)),
    ...(await budgetCandidates(userId)),
    ...(await subscriptionCandidates(userId)),
  ];
  return recordAndDeliver(userId, candidates);
}
