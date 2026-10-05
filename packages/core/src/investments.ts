/**
 * The Investments page's arithmetic and wording, shared by web and mobile:
 * holdings rolled up into positions, per-position gain, allocation views,
 * plain-language activity rows, and the value/invested history the chart
 * draws. Pure -- no DB, no FX; callers pass amounts already converted to
 * one currency.
 */
import { formatSecurityType } from "./portfolioMath";

// ---------------------------------------------------------------------------
// Positions
// ---------------------------------------------------------------------------

export interface HoldingInput {
  accountId: string;
  accountName: string;
  securityId: string;
  ticker: string | null;
  securityName: string | null;
  assetType: string;
  isCashEquivalent: boolean;
  /** Numeric column as a string (keeps full precision on the wire). */
  quantity: string;
  /** Cents, already in the display currency. */
  institutionValue: number;
  costBasis: number | null;
  /** What the institution reported this holding in, before conversion. */
  originalCurrency: string;
}

export interface Gain {
  amount: number;
  /** Fraction of cost basis, e.g. 0.103 for +10.3%. */
  pct: number;
}

export interface PositionLot {
  accountId: string;
  accountName: string;
  quantity: number;
  value: number;
  costBasis: number | null;
  gain: Gain | null;
}

export interface Position {
  securityId: string;
  ticker: string | null;
  securityName: string | null;
  assetType: string;
  isCashEquivalent: boolean;
  quantity: number;
  value: number;
  /** Null when any lot is missing cost basis -- a partial basis would overstate the gain. */
  costBasis: number | null;
  gain: Gain | null;
  /** Share of the whole portfolio, 0-1. */
  weight: number;
  originalCurrencies: string[];
  /** One per account holding this security, largest first. */
  lots: PositionLot[];
}

/** Gain vs. cost basis; null for cash and whenever cost basis is unknown or zero. */
export function gainFor(value: number, costBasis: number | null, isCash = false): Gain | null {
  if (isCash || costBasis == null || costBasis <= 0) return null;
  return { amount: value - costBasis, pct: (value - costBasis) / costBasis };
}

/**
 * One row per security across every account (the same ETF in a TFSA and an
 * RRSP is one position with two lots), sorted by value.
 */
export function rollUpPositions(holdings: HoldingInput[]): Position[] {
  const total = holdings.reduce((s, h) => s + h.institutionValue, 0);
  const bySecurity = new Map<string, HoldingInput[]>();
  for (const h of holdings) bySecurity.set(h.securityId, [...(bySecurity.get(h.securityId) ?? []), h]);

  const positions: Position[] = [];
  for (const [securityId, group] of bySecurity) {
    const first = group[0]!;
    const value = group.reduce((s, h) => s + h.institutionValue, 0);
    const costBasis = group.every((h) => h.costBasis != null) ? group.reduce((s, h) => s + h.costBasis!, 0) : null;
    positions.push({
      securityId,
      ticker: first.ticker,
      securityName: first.securityName,
      assetType: first.assetType,
      isCashEquivalent: first.isCashEquivalent,
      quantity: group.reduce((s, h) => s + (parseFloat(h.quantity) || 0), 0),
      value,
      costBasis,
      gain: gainFor(value, costBasis, first.isCashEquivalent),
      weight: total > 0 ? value / total : 0,
      originalCurrencies: [...new Set(group.map((h) => h.originalCurrency))].sort(),
      lots: group
        .map((h) => ({
          accountId: h.accountId,
          accountName: h.accountName,
          quantity: parseFloat(h.quantity) || 0,
          value: h.institutionValue,
          costBasis: h.costBasis,
          gain: gainFor(h.institutionValue, h.costBasis, h.isCashEquivalent),
        }))
        .sort((a, b) => b.value - a.value),
    });
  }
  return positions.sort((a, b) => b.value - a.value);
}

/** Unrealized gain over the positions that have a cost basis, and how many that is. */
export function unrealizedGainTotal(positions: Position[]): { amount: number; covered: number; total: number } {
  const withGain = positions.filter((p) => p.gain);
  const nonCash = positions.filter((p) => !p.isCashEquivalent);
  return { amount: withGain.reduce((s, p) => s + p.gain!.amount, 0), covered: withGain.length, total: nonCash.length };
}

// ---------------------------------------------------------------------------
// Allocation
// ---------------------------------------------------------------------------

export type AllocationView = "type" | "account" | "holding";

export interface Slice {
  label: string;
  value: number;
  pct: number;
}

/** Holdings view keeps the largest few and folds the rest into "Other". */
const HOLDING_SLICES = 5;

export function allocationBy(holdings: HoldingInput[], view: AllocationView): Slice[] {
  const totals = new Map<string, number>();
  for (const h of holdings) {
    const label =
      view === "account"
        ? h.accountName
        : view === "holding"
          ? (h.ticker ?? h.securityName ?? "Unknown")
          : h.isCashEquivalent
            ? "Cash"
            : formatSecurityType(h.assetType);
    totals.set(label, (totals.get(label) ?? 0) + h.institutionValue);
  }
  const total = [...totals.values()].reduce((a, b) => a + b, 0);
  if (total <= 0) return [];
  let slices = [...totals.entries()].map(([label, value]) => ({ label, value, pct: value / total })).sort((a, b) => b.value - a.value);
  if (view === "holding" && slices.length > HOLDING_SLICES + 1) {
    const rest = slices.slice(HOLDING_SLICES);
    const restValue = rest.reduce((s, x) => s + x.value, 0);
    slices = [...slices.slice(0, HOLDING_SLICES), { label: `${rest.length} others`, value: restValue, pct: restValue / total }];
  }
  return slices;
}

// ---------------------------------------------------------------------------
// Activity
// ---------------------------------------------------------------------------

export interface TxnInput {
  type: string | null;
  subtype: string | null;
  name: string | null;
  ticker: string | null;
  securityName: string | null;
  quantity: string | number | null;
  /** Cents per share, display currency. */
  price: number | null;
  /** Plaid convention: positive = cash out of the account, negative = cash in. Display currency. */
  amount: number;
}

export type TxnFilter = "trades" | "income" | "deposits" | "fees" | "other";
export type TxnIcon = "buy" | "sell" | "income" | "deposit" | "withdrawal" | "transfer" | "fee" | "other";

export interface TxnDescription {
  title: string;
  /** "$34.10 each" for trades; the security name for income. Null otherwise. */
  detail: string | null;
  icon: TxnIcon;
  tone: "positive" | "negative" | "neutral";
  filter: TxnFilter;
  /** Cents to display. Trades are unsigned trade size; everything else is the signed cash effect (+ in, − out). */
  amount: number;
  signed: boolean;
}

const INCOME_SUBTYPES = new Set(["dividend", "qualified dividend", "non-qualified dividend", "interest", "long-term capital gain", "short-term capital gain", "dividend reinvestment"]);
const DEPOSIT_SUBTYPES = new Set(["contribution", "deposit"]);

/**
 * Whether a transaction is external money in/out (counts toward "Invested"),
 * as opposed to market activity. Mirrors the contribution rule in
 * apps/web/lib/portfolio.ts: transfers, plus cash contributions, deposits
 * and withdrawals.
 */
export function isContribution(type: string | null, subtype: string | null): boolean {
  if (type === "transfer") return true;
  return type === "cash" && (subtype === "contribution" || subtype === "deposit" || subtype === "withdrawal");
}

function qty(q: string | number | null): string {
  const n = typeof q === "string" ? parseFloat(q) : q;
  if (n == null || !Number.isFinite(n)) return "";
  const abs = Math.abs(n);
  return Number.isInteger(abs) ? abs.toLocaleString("en-US") : abs.toFixed(4).replace(/0+$/, "").replace(/\.$/, "");
}

function sentence(s: string): string {
  const t = s.trim().toLowerCase();
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/** One activity row in plain words: verb, icon, color, filter bucket and the amount to show. */
export function describeInvestmentTxn(t: TxnInput, formatMoney: (cents: number) => string): TxnDescription {
  const type = (t.type ?? "").toLowerCase();
  const subtype = (t.subtype ?? "").toLowerCase();
  const symbol = t.ticker ?? t.securityName ?? "";
  const cashIn = -t.amount; // + means money came into the account
  const each = t.price != null && t.price > 0 ? `${formatMoney(Math.abs(t.price))} each` : null;
  const n = qty(t.quantity);

  if (type === "buy" && subtype !== "dividend reinvestment") {
    return { title: `Bought ${n ? `${n} ` : ""}${symbol}`.trim(), detail: each, icon: "buy", tone: "neutral", filter: "trades", amount: Math.abs(t.amount), signed: false };
  }
  if (type === "sell") {
    return { title: `Sold ${n ? `${n} ` : ""}${symbol}`.trim(), detail: each, icon: "sell", tone: "neutral", filter: "trades", amount: Math.abs(t.amount), signed: false };
  }
  if (type === "fee" || subtype.includes("fee")) {
    return { title: t.name && !/^fee$/i.test(t.name) ? sentence(t.name) : "Account fee", detail: null, icon: "fee", tone: "negative", filter: "fees", amount: cashIn, signed: true };
  }
  if (INCOME_SUBTYPES.has(subtype)) {
    const label = subtype === "interest" ? "Interest" : subtype.includes("capital gain") ? "Capital gain distribution" : subtype === "dividend reinvestment" ? "Dividend reinvested" : "Dividend";
    return {
      title: symbol && subtype !== "interest" ? `${label} from ${symbol}` : label,
      detail: t.securityName && t.ticker ? t.securityName : null,
      icon: "income",
      tone: subtype === "dividend reinvestment" ? "neutral" : "positive",
      filter: "income",
      amount: subtype === "dividend reinvestment" ? Math.abs(t.amount) : Math.abs(cashIn),
      signed: subtype !== "dividend reinvestment",
    };
  }
  if (type === "transfer") {
    const inbound = cashIn >= 0;
    return { title: `Transferred ${inbound ? "in" : "out"}${n && symbol ? ` ${n} ${symbol}` : ""}`, detail: null, icon: "transfer", tone: "neutral", filter: "deposits", amount: cashIn, signed: true };
  }
  if (type === "cash" && DEPOSIT_SUBTYPES.has(subtype)) {
    return { title: "Contribution", detail: null, icon: "deposit", tone: "neutral", filter: "deposits", amount: Math.abs(cashIn), signed: true };
  }
  if (type === "cash" && subtype === "withdrawal") {
    return { title: "Withdrawal", detail: null, icon: "withdrawal", tone: "neutral", filter: "deposits", amount: -Math.abs(cashIn), signed: true };
  }
  return { title: t.name ? sentence(t.name) : sentence(subtype || type || "Transaction"), detail: null, icon: "other", tone: "neutral", filter: "other", amount: cashIn, signed: true };
}

// ---------------------------------------------------------------------------
// History
// ---------------------------------------------------------------------------

export interface HistorySnapshot {
  accountId: string;
  /** YYYY-MM-DD */
  date: string;
  /** Sum of that account's holdings on that date, cents. */
  value: number;
}

export interface HistoryContribution {
  /** YYYY-MM-DD */
  date: string;
  /** Plaid convention (negative = money in). */
  amount: number;
}

export interface HistoryPoint {
  date: string;
  value: number;
  /** Money put in so far: starting value + net contributions + accounts that joined later. */
  invested: number;
}

/**
 * Daily portfolio value and money-in from per-account holdings snapshots.
 * An account carries its last snapshot forward on days it has none, and an
 * account that first appears mid-history adds its starting value to
 * "invested" (it was brought in, not earned).
 */
export function buildPortfolioHistory(snapshots: HistorySnapshot[], contributions: HistoryContribution[]): HistoryPoint[] {
  if (snapshots.length === 0) return [];
  const dates = [...new Set(snapshots.map((s) => s.date))].sort();
  const byDate = new Map<string, HistorySnapshot[]>();
  for (const s of snapshots) byDate.set(s.date, [...(byDate.get(s.date) ?? []), s]);
  const contribs = [...contributions].sort((a, b) => a.date.localeCompare(b.date));

  const latest = new Map<string, number>();
  const points: HistoryPoint[] = [];
  let invested = 0;
  let ci = 0;
  for (const [i, date] of dates.entries()) {
    for (const s of byDate.get(date)!) {
      if (!latest.has(s.accountId)) invested += s.value; // first sight of this account
      latest.set(s.accountId, s.value);
    }
    if (i === 0) {
      // Contributions before the first snapshot are already inside it.
      while (ci < contribs.length && contribs[ci]!.date <= date) ci++;
    } else {
      while (ci < contribs.length && contribs[ci]!.date <= date) invested -= contribs[ci++]!.amount;
    }
    points.push({ date, value: [...latest.values()].reduce((a, b) => a + b, 0), invested });
  }
  return points;
}

export type HistoryRange = "1M" | "3M" | "YTD" | "1Y" | "ALL";

/** First date (YYYY-MM-DD) a range covers, relative to `today`; null for ALL. */
export function rangeStart(range: HistoryRange, today: string): string | null {
  if (range === "ALL") return null;
  const d = new Date(`${today}T00:00:00Z`);
  if (range === "YTD") return `${d.getUTCFullYear()}-01-01`;
  const months = range === "1M" ? 1 : range === "3M" ? 3 : 12;
  d.setUTCMonth(d.getUTCMonth() - months);
  return d.toISOString().slice(0, 10);
}

export interface RangeSummary {
  points: HistoryPoint[];
  /** Market growth over the range: value change minus money added. */
  growth: number;
  added: number;
  /** False when history doesn't reach back to the range's start. */
  covered: boolean;
}

export function summarizeRange(history: HistoryPoint[], range: HistoryRange, today: string): RangeSummary {
  const start = rangeStart(range, today);
  const points = start ? history.filter((p) => p.date >= start) : history;
  const covered = !start || (history[0] != null && history[0].date <= start);
  if (points.length === 0) return { points, growth: 0, added: 0, covered };
  const first = points[0]!;
  const last = points[points.length - 1]!;
  const added = last.invested - first.invested;
  return { points, growth: last.value - first.value - added, added, covered };
}
