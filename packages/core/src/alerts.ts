import { formatCents } from "./money";

/**
 * Alert checks (ALERTS.md §2, §4). Pure: each takes plain rows and returns
 * candidates; apps/web/lib/alerts loads the rows, claims each candidate's
 * dedupe key in alert_events, and delivers. Nothing here knows about the
 * database, push or email.
 */

export type AlertType = "budget_threshold" | "connection_broken" | "large_transaction" | "subscription_change";

export interface AlertCandidate {
  type: AlertType;
  /** Unique per real event; alert_events' (user_id, dedupe_key) index makes it fire once. */
  dedupeKey: string;
  title: string;
  body: string;
  /** In-app path the alert opens. */
  url: string;
  /**
   * Recorded but never delivered: e.g. the 80% budget step when a single sync
   * jumps straight past 100%, so it can't fire later on its own.
   */
  silent?: boolean;
  payload?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Budget thresholds (§4.2)

export interface BudgetInput {
  categoryId: string;
  categoryName: string;
  /** Spendable this month in cents, rollover included. */
  limit: number;
  /** Spent this month in cents, as a positive magnitude. */
  spend: number;
}

export const BUDGET_STEPS = [0.8, 1] as const;

function daysLeftLabel(daysLeft: number): string {
  if (daysLeft <= 0) return "last day of the month";
  return `${daysLeft} day${daysLeft === 1 ? "" : "s"} left`;
}

/**
 * One candidate per step a budget has reached this month. Stateless: the
 * dedupe key (per category, month and step) is what makes each step fire
 * once, so raising a limit afterwards doesn't re-arm it. When 100% is
 * reached, the 80% step comes back silent so it's recorded but not sent.
 */
export function budgetAlerts(budgets: BudgetInput[], month: string, daysLeft: number): AlertCandidate[] {
  const ym = month.slice(0, 7);
  const out: AlertCandidate[] = [];
  for (const b of budgets) {
    if (b.limit <= 0) continue;
    const ratio = b.spend / b.limit;
    const reachedFull = ratio >= 1;
    for (const step of BUDGET_STEPS) {
      if (ratio < step) continue;
      const pct = Math.floor(ratio * 100);
      const over = reachedFull;
      const title = over ? `${b.categoryName} is over budget` : `${b.categoryName} is at ${pct}%`;
      out.push({
        type: "budget_threshold",
        dedupeKey: `budget:${b.categoryId}:${ym}:${Math.round(step * 100)}`,
        title,
        body: `${formatCents(b.spend)} of ${formatCents(b.limit)} spent, ${daysLeftLabel(daysLeft)}.`,
        url: "/budgets",
        silent: step < 1 && reachedFull,
        payload: { categoryId: b.categoryId, month: ym, step, spend: b.spend, limit: b.limit },
      });
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Large transactions (§4.3)

export interface TransactionInput {
  id: string;
  plaidTransactionId: string | null;
  /** Set on a posted row that replaced a pending one; keys both to the same alert. */
  pendingTransactionId: string | null;
  /** Cents; expenses negative. */
  amount: number;
  isTransfer: boolean;
  merchantKey: string;
  merchantLabel: string;
  accountLabel: string;
}

export const MERCHANT_MULTIPLE = 3;
export const MERCHANT_MULTIPLE_FLOOR_CENTS = 10_000; // $100
export const MIN_MERCHANT_HISTORY = 3;

export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}

/**
 * `history` maps merchantKey to that merchant's past spend magnitudes (last
 * 6 months, transfers excluded, the new rows themselves excluded).
 */
export function largeTransactionAlerts(
  txns: TransactionInput[],
  history: Map<string, number[]>,
  thresholdCents: number,
): AlertCandidate[] {
  const out: AlertCandidate[] = [];
  for (const t of txns) {
    if (t.isTransfer || t.amount >= 0) continue;
    const magnitude = -t.amount;
    const past = history.get(t.merchantKey) ?? [];
    const med = past.length >= MIN_MERCHANT_HISTORY ? median(past) : null;
    const overThreshold = magnitude >= thresholdCents;
    const unusual = med != null && magnitude >= MERCHANT_MULTIPLE * med && magnitude >= MERCHANT_MULTIPLE_FLOOR_CENTS;
    if (!overThreshold && !unusual) continue;
    const key = t.pendingTransactionId ?? t.plaidTransactionId ?? t.id;
    out.push({
      type: "large_transaction",
      dedupeKey: `txn:${key}`,
      title: `${formatCents(magnitude)} at ${t.merchantLabel}`,
      body: unusual && !overThreshold ? `${t.accountLabel} · about ${Math.round(magnitude / med!)}× what you usually spend there.` : t.accountLabel,
      // Web has no single-transaction route; its exact-merchant filter shows the
      // charge in context. Mobile opens /transactions/{payload.transactionId}.
      url: `/transactions?merchant=${encodeURIComponent(t.merchantLabel)}`,
      payload: { transactionId: t.id, amount: t.amount, reason: overThreshold ? "threshold" : "merchant_multiple", median: med },
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Subscriptions (§4.4)

export type Frequency = "weekly" | "biweekly" | "monthly" | "quarterly" | "annual";

export interface StreamInput {
  id: string;
  description: string;
  frequency: Frequency;
  /** Real charges (cents, expenses negative), oldest first. */
  charges: { amount: number; date: string }[];
}

const PER: Record<Frequency, string> = {
  weekly: "a week",
  biweekly: "every 2 weeks",
  monthly: "a month",
  quarterly: "a quarter",
  annual: "a year",
};

export const PRICE_CHANGE_MIN_RATIO = 0.05;
export const PRICE_CHANGE_MIN_CENTS = 100;

export function subscriptionAlerts(streams: StreamInput[]): AlertCandidate[] {
  const out: AlertCandidate[] = [];
  for (const s of streams) {
    const charges = s.charges.filter((c) => c.amount < 0);
    const latest = charges.at(-1);
    if (!latest) continue;
    const latestMag = -latest.amount;
    out.push({
      type: "subscription_change",
      dedupeKey: `sub_new:${s.id}`,
      title: `New subscription: ${s.description}`,
      body: `${formatCents(latestMag)} ${PER[s.frequency]}.`,
      url: "/subscriptions",
      payload: { streamId: s.id, kind: "new" },
    });
    const prev = charges.at(-2);
    if (!prev) continue;
    const prevMag = -prev.amount;
    const increase = latestMag - prevMag;
    if (increase >= PRICE_CHANGE_MIN_CENTS && increase >= prevMag * PRICE_CHANGE_MIN_RATIO) {
      out.push({
        type: "subscription_change",
        dedupeKey: `sub_price:${s.id}:${latestMag}`,
        title: `${s.description} went up`,
        body: `${formatCents(prevMag)} → ${formatCents(latestMag)} ${PER[s.frequency]}.`,
        url: "/subscriptions",
        payload: { streamId: s.id, kind: "price", from: prevMag, to: latestMag },
      });
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Connections

export interface ItemInput {
  id: string;
  institutionName: string | null;
  status: "healthy" | "login_required" | "pending_expiration" | "revoked" | "error";
  /** Last successful sync; part of the key so a later, separate breakage alerts again. */
  lastSyncedAt: Date | null;
}

export function connectionAlerts(items: ItemInput[]): AlertCandidate[] {
  const out: AlertCandidate[] = [];
  for (const i of items) {
    if (i.status !== "login_required" && i.status !== "error" && i.status !== "pending_expiration") continue;
    const name = i.institutionName ?? "A connection";
    const epoch = i.lastSyncedAt ? i.lastSyncedAt.toISOString() : "never";
    const [title, body] =
      i.status === "login_required"
        ? [`${name} needs you to sign in again`, "Syncing is paused until you reconnect."]
        : i.status === "pending_expiration"
          ? [`${name} will need you to sign in again soon`, "Reconnect now to keep syncing without a gap."]
          : [`${name} stopped syncing`, "Open Accounts to see what happened and reconnect."];
    out.push({
      type: "connection_broken",
      dedupeKey: `conn:${i.id}:${i.status}:${epoch}`,
      title,
      body,
      url: "/accounts",
      payload: { itemId: i.id, status: i.status },
    });
  }
  return out;
}
