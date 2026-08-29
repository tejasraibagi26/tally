import { and, eq, inArray } from "drizzle-orm";
import { db, schema } from "@/db";
import { monthTotals, categoryBreakdown, cashFlowTrend, trailingAnnualCashFlowEstimate, type BreakdownRow } from "@/lib/analytics";
import { getBudgetsForMonth } from "@/lib/budgets";
import { netWorthTrend } from "@/lib/networth";
import { monthRange, shiftMonth, monthLastDay } from "@tally/core/budgetMath";
import { fireNumber, fireProgressPct, yearsToFire, ageAsOf, fireAgeAndYear } from "@tally/core/fireMath";
import { formatPercent } from "@tally/core/money";

// Matches CategorySpendBar.tsx's convention: color by rank position, not the
// category's own stored colorSlot (siblings under one parent all share a
// colorSlot). Hex values are globals.css's LIGHT theme --series-1..8 — the
// email forces color-scheme:light, so dark-theme tokens would never apply.
const SERIES_COLORS = ["#1baf7a", "#eb6834", "#2a78d6", "#eda100", "#e87ba4", "#008300", "#4a3aa7", "#e34948"];
const OTHER_COLOR = "#938C7D";

const FREQUENCY_MONTHLY_MULTIPLIER: Record<string, number> = {
  weekly: 52 / 12,
  biweekly: 26 / 12,
  monthly: 1,
  quarterly: 1 / 3,
  annual: 1 / 12,
};

const PRICE_INCREASE_THRESHOLD = 0.03; // 3% — below this, treat as noise/rounding, not a real price bump

function monthLabel(month: string, style: "long" | "short" = "long"): string {
  return new Date(month + "T00:00:00Z").toLocaleDateString("en-US", { month: style, timeZone: "UTC" });
}

export interface CategoryRow {
  label: string;
  amount: number;
  pct: number;
  color: string;
}

export interface BudgetRow {
  categoryName: string;
  spend: number;
  budgeted: number;
  overBy: number | null;
}

export interface PriceIncrease {
  label: string;
  oldAmount: number;
  newAmount: number;
  pctIncrease: string;
}

export interface FireRecap {
  onPaceAge: number;
  onPaceYear: number;
  yearsToGo: number;
  yearsSoonerThanLastMonth: number | null;
  currentValue: number;
  fireNumberValue: number;
  progressPct: number;
}

export interface MonthlyRecapData {
  month: string;
  monthLabel: string;
  userName: string | null;
  income: number;
  spend: number;
  saved: number;
  savingsRate: number;
  bestMonthLine: string | null;

  hasBudgets: boolean;
  budgets: BudgetRow[];
  budgetsOmitted: number;

  hasCategories: boolean;
  categories: CategoryRow[];

  hasSparkline: boolean;
  netWorth: number;
  netWorthDeltaAmount: number | null;
  netWorthDeltaPct: number | null;
  netWorthDeltaDirection: "up" | "down" | null;
  sparklinePath: string;
  sparklineFillPath: string;
  sparklineLastX: number;
  sparklineLastY: number;
  sparklineLabels: string[];

  hasSubscriptions: boolean;
  subscriptionsActiveCount: number;
  subscriptionsMonthlyTotal: number;
  priceIncrease: PriceIncrease | null;

  fire: FireRecap | null;
}

/**
 * Only claims "best month since X" when literally true — every one of the
 * trailing 12 months had a lower savings rate. If any prior month matches or
 * beats this one, the sentence is omitted rather than guessing a plausible-
 * sounding "since" date (cashFlowTrend is ascending, oldest first).
 */
async function bestMonthLine(userId: string, month: string, thisMonthRate: number): Promise<string | null> {
  if (thisMonthRate <= 0) return null;
  const trend = await cashFlowTrend(userId, 13); // trailing 12 months + the just-started current month
  const priorMonths = trend.filter((m) => m.month < month && m.month >= shiftMonth(month, -12));
  if (priorMonths.length === 0) return null;

  for (const m of priorMonths) {
    const rate = m.income > 0 ? (m.income - m.spend) / m.income : 0;
    if (rate >= thisMonthRate) return null;
  }
  return `your best month since ${monthLabel(priorMonths[0]!.month, "long")}.`;
}

function bucketCategories(breakdown: BreakdownRow[]): CategoryRow[] {
  const top = breakdown.slice(0, 4);
  const restTotal = breakdown.slice(4).reduce((s, r) => s + r.total, 0);
  const total = breakdown.reduce((s, r) => s + r.total, 0);
  if (total === 0) return [];

  const rows: CategoryRow[] = top.map((r, i) => ({
    label: r.label,
    amount: r.total,
    pct: r.total / total,
    color: SERIES_COLORS[i % SERIES_COLORS.length]!,
  }));
  if (restTotal > 0) {
    rows.push({ label: "Everything else", amount: restTotal, pct: restTotal / total, color: OTHER_COLOR });
  }
  return rows.sort((a, b) => b.amount - a.amount);
}

async function monthlyNetWorthPoints(userId: string, month: string, count = 6): Promise<{ month: string; net: number }[]> {
  const oldest = shiftMonth(month, -(count - 1));
  const trend = await netWorthTrend(userId, 400); // ascending by date; wide enough to cover `count` months back

  const points: { month: string; net: number }[] = [];
  let cursor = oldest;
  for (let i = 0; i < count; i++) {
    const cutoff = monthLastDay(cursor);
    const candidates = trend.filter((p) => p.asOfDate <= cutoff);
    const point = candidates[candidates.length - 1];
    if (point) points.push({ month: cursor, net: point.net });
    cursor = shiftMonth(cursor, 1);
  }
  return points;
}

function buildSparkline(points: { month: string; net: number }[]): { path: string; fillPath: string; lastX: number; lastY: number; labels: string[] } {
  const values = points.map((p) => p.net);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const n = points.length;
  const step = n > 1 ? 240 / (n - 1) : 0;

  const coords = points.map((p, i) => {
    const x = 4 + i * step;
    const y = max === min ? 28 : 52 - ((p.net - min) / (max - min)) * 48;
    return { x, y };
  });

  const line = coords.map((c, i) => `${i === 0 ? "M" : "L"}${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(" ");
  const last = coords[coords.length - 1]!;
  const first = coords[0]!;
  const fill = `${line} L${last.x.toFixed(1)},56 L${first.x.toFixed(1)},56 Z`;

  return { path: line, fillPath: fill, lastX: last.x, lastY: last.y, labels: points.map((p) => monthLabel(p.month, "short")) };
}

async function computeSubscriptions(userId: string, month: string) {
  const streams = await db
    .select({
      id: schema.recurringStreams.id,
      description: schema.recurringStreams.description,
      merchantKey: schema.recurringStreams.merchantKey,
      averageAmount: schema.recurringStreams.averageAmount,
      frequency: schema.recurringStreams.frequency,
      status: schema.recurringStreams.status,
      manualNextDueDate: schema.recurringStreams.manualNextDueDate,
      transactionIds: schema.recurringStreams.transactionIds,
    })
    .from(schema.recurringStreams)
    .where(eq(schema.recurringStreams.userId, userId));

  const active = streams.filter((s) => (s.status !== "cancelled" || s.manualNextDueDate != null) && s.averageAmount < 0);
  const monthlyTotal = active.reduce((sum, s) => sum + Math.abs(s.averageAmount) * (FREQUENCY_MONTHLY_MULTIPLIER[s.frequency] ?? 1), 0);

  // No stored history of past monthlyTotal to diff against, so the recap
  // reports the current total and a specific per-merchant price increase
  // (detectPriceIncrease, a real signal from actual transaction amounts)
  // rather than fabricating a month-over-month delta for the total itself.
  const priceIncrease = await detectPriceIncrease(active, month);

  return { activeCount: active.length, monthlyTotal, priceIncrease };
}

async function detectPriceIncrease(
  streams: { id: string; description: string | null; merchantKey: string; transactionIds: string[] }[],
  month: string,
): Promise<PriceIncrease | null> {
  const { start, end } = monthRange(month);
  let best: (PriceIncrease & { delta: number }) | null = null;

  for (const s of streams) {
    if (s.transactionIds.length < 2) continue;
    const txs = await db
      .select({ amount: schema.transactions.amount, postedDate: schema.transactions.postedDate })
      .from(schema.transactions)
      .where(inArray(schema.transactions.id, s.transactionIds));
    txs.sort((a, b) => a.postedDate.localeCompare(b.postedDate));

    const inMonth = txs.filter((t) => t.postedDate >= start && t.postedDate < end);
    if (inMonth.length === 0) continue;
    const latest = inMonth[inMonth.length - 1]!;
    const before = txs.filter((t) => t.postedDate < latest.postedDate);
    if (before.length === 0) continue;
    const prior = before[before.length - 1]!;

    const newAmount = Math.abs(latest.amount);
    const oldAmount = Math.abs(prior.amount);
    if (oldAmount <= 0) continue;
    const pct = (newAmount - oldAmount) / oldAmount;
    if (pct <= PRICE_INCREASE_THRESHOLD) continue;

    const delta = newAmount - oldAmount;
    if (!best || delta > best.delta) {
      best = { label: s.description ?? s.merchantKey, oldAmount, newAmount, pctIncrease: formatPercent(pct), delta };
    }
  }
  return best ? { label: best.label, oldAmount: best.oldAmount, newAmount: best.newAmount, pctIncrease: best.pctIncrease } : null;
}

async function computeFire(userId: string, birthDate: string | null, priorYearsToFire: number | null): Promise<FireRecap | null> {
  if (!birthDate) return null;

  const [fireSettingsRow] = await db.select().from(schema.fireSettings).where(eq(schema.fireSettings.userId, userId)).limit(1);
  if (!fireSettingsRow) return null;

  const accounts = await db.query.accounts.findMany({ where: eq(schema.accounts.userId, userId) });
  const investableNetWorth = accounts.filter((a) => a.type === "investment").reduce((sum, a) => sum + (a.currentBalance ?? 0), 0);

  const { income: totalIncome, expenses: defaultAnnualExpenses } = await trailingAnnualCashFlowEstimate(userId, 12);
  const defaultMonthlyContribution = Math.max(0, Math.round((totalIncome - defaultAnnualExpenses) / 12));

  const annualExpenses = fireSettingsRow.annualExpensesOverride ?? defaultAnnualExpenses;
  const monthlyContribution = fireSettingsRow.monthlyContributionOverride ?? defaultMonthlyContribution;
  const swr = Number(fireSettingsRow.swr);
  const annualReturnRate = Number(fireSettingsRow.expectedReturn);

  const fireNumberValue = fireNumber(annualExpenses, swr);
  const result = yearsToFire({ currentValue: investableNetWorth, monthlyContribution, annualReturnRate, targetValue: fireNumberValue });
  if (result.years == null) return null;

  const today = new Date().toISOString().slice(0, 10);
  const currentAge = ageAsOf(birthDate, today);
  const { age, year } = fireAgeAndYear(currentAge, result.years, today);

  return {
    onPaceAge: Math.round(age),
    onPaceYear: year,
    yearsToGo: result.years,
    yearsSoonerThanLastMonth: priorYearsToFire != null ? priorYearsToFire - result.years : null,
    currentValue: investableNetWorth,
    fireNumberValue,
    progressPct: fireProgressPct(investableNetWorth, fireNumberValue),
  };
}

export async function computeMonthlyRecap(userId: string, month: string): Promise<MonthlyRecapData> {
  const [user] = await db.select({ name: schema.users.name, birthDate: schema.users.birthDate }).from(schema.users).where(eq(schema.users.id, userId)).limit(1);

  const priorMonth = shiftMonth(month, -1);
  const [{ income, spend }, budgetLines, breakdown, points, subs, priorRecap] = await Promise.all([
    monthTotals(userId, month),
    getBudgetsForMonth(userId, month),
    categoryBreakdown(userId, month),
    monthlyNetWorthPoints(userId, month, 6),
    computeSubscriptions(userId, month),
    db.select({ yearsToFire: schema.monthlyRecaps.yearsToFire }).from(schema.monthlyRecaps).where(and(eq(schema.monthlyRecaps.userId, userId), eq(schema.monthlyRecaps.month, priorMonth))).limit(1),
  ]);

  const saved = income - spend;
  const savingsRate = income > 0 ? saved / income : 0;
  const bestMonth = await bestMonthLine(userId, month, savingsRate);

  const budgets: BudgetRow[] = budgetLines.slice(0, 8).map((b) => ({
    categoryName: b.categoryName,
    spend: b.spend,
    budgeted: b.amount + b.rolloverFromPrior,
    overBy: b.remaining < 0 ? Math.abs(b.remaining) : null,
  }));

  const categories = bucketCategories(breakdown);

  const hasSparkline = points.length >= 2;
  const sparkline = hasSparkline ? buildSparkline(points) : { path: "", fillPath: "", lastX: 0, lastY: 0, labels: [] };
  const netWorth = points.length > 0 ? points[points.length - 1]!.net : 0;
  const priorNetWorth = points.length > 1 ? points[points.length - 2]!.net : null;
  const netWorthDeltaAmount = priorNetWorth != null ? netWorth - priorNetWorth : null;
  const netWorthDeltaPct = priorNetWorth != null && priorNetWorth !== 0 ? (netWorth - priorNetWorth) / Math.abs(priorNetWorth) : null;

  const priorYearsToFire = priorRecap[0]?.yearsToFire != null ? Number(priorRecap[0].yearsToFire) : null;
  const fire = await computeFire(userId, user?.birthDate ?? null, priorYearsToFire);

  return {
    month,
    monthLabel: monthLabel(month, "long"),
    userName: user?.name ?? null,
    income,
    spend,
    saved,
    savingsRate,
    bestMonthLine: bestMonth,

    hasBudgets: budgets.length > 0,
    budgets,
    budgetsOmitted: Math.max(0, budgetLines.length - 8),

    hasCategories: categories.length > 0,
    categories,

    hasSparkline,
    netWorth,
    netWorthDeltaAmount,
    netWorthDeltaPct,
    netWorthDeltaDirection: netWorthDeltaAmount != null ? (netWorthDeltaAmount >= 0 ? "up" : "down") : null,
    sparklinePath: sparkline.path,
    sparklineFillPath: sparkline.fillPath,
    sparklineLastX: sparkline.lastX,
    sparklineLastY: sparkline.lastY,
    sparklineLabels: sparkline.labels,

    hasSubscriptions: subs.activeCount > 0,
    subscriptionsActiveCount: subs.activeCount,
    subscriptionsMonthlyTotal: subs.monthlyTotal,
    priceIncrease: subs.priceIncrease,

    fire,
  };
}
