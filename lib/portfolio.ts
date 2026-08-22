import { and, eq, gte, inArray, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { computeAllocation, computeSimpleReturn, type AllocationSlice, type HoldingLike } from "@/lib/portfolioMath";

export interface HoldingRow {
  accountId: string;
  accountName: string;
  securityId: string;
  ticker: string | null;
  securityName: string | null;
  assetType: string;
  isCashEquivalent: boolean;
  quantity: string; // numeric column — string-precision, format for display
  institutionValue: number; // cents
  costBasis: number | null; // cents
}

async function investmentAccountIds(userId: string): Promise<{ id: string; name: string }[]> {
  return db
    .select({ id: schema.accounts.id, name: schema.accounts.name })
    .from(schema.accounts)
    .where(and(eq(schema.accounts.userId, userId), eq(schema.accounts.type, "investment")));
}

/** §9 "Portfolio value"/"Allocation": the latest holdings snapshot per investment account (dates can differ slightly account to account). */
export async function latestHoldingsForUser(userId: string): Promise<HoldingRow[]> {
  const accounts = await investmentAccountIds(userId);
  if (accounts.length === 0) return [];
  const accountIds = accounts.map((a) => a.id);
  const accountNameById = new Map(accounts.map((a) => [a.id, a.name]));

  const latestDates = await db
    .select({ accountId: schema.holdings.accountId, maxDate: sql<string>`max(${schema.holdings.asOfDate})` })
    .from(schema.holdings)
    .where(inArray(schema.holdings.accountId, accountIds))
    .groupBy(schema.holdings.accountId);
  if (latestDates.length === 0) return [];

  const rows: HoldingRow[] = [];
  for (const { accountId, maxDate } of latestDates) {
    const holdingRows = await db
      .select({
        securityId: schema.holdings.securityId,
        quantity: schema.holdings.quantity,
        institutionValue: schema.holdings.institutionValue,
        costBasis: schema.holdings.costBasis,
        ticker: schema.securities.ticker,
        securityName: schema.securities.name,
        assetType: schema.securities.type,
        isCashEquivalent: schema.securities.isCashEquivalent,
      })
      .from(schema.holdings)
      .innerJoin(schema.securities, eq(schema.holdings.securityId, schema.securities.id))
      .where(and(eq(schema.holdings.accountId, accountId), eq(schema.holdings.asOfDate, maxDate)));

    for (const h of holdingRows) {
      rows.push({
        accountId,
        accountName: accountNameById.get(accountId) ?? "",
        securityId: h.securityId,
        ticker: h.ticker,
        securityName: h.securityName,
        assetType: h.assetType ?? "other",
        isCashEquivalent: h.isCashEquivalent,
        quantity: h.quantity,
        institutionValue: h.institutionValue,
        costBasis: h.costBasis,
      });
    }
  }
  return rows;
}

export function portfolioValue(holdings: HoldingRow[]): number {
  return holdings.reduce((sum, h) => sum + h.institutionValue, 0);
}

export function allocationFor(holdings: HoldingRow[]): AllocationSlice[] {
  const holdingLikes: HoldingLike[] = holdings.map((h) => ({
    institutionValue: h.institutionValue,
    isCashEquivalent: h.isCashEquivalent,
    assetType: h.assetType,
  }));
  return computeAllocation(holdingLikes);
}

/** Unrealized gain vs. institution-reported cost basis — a different, simpler metric than "Portfolio return" below; only covers holdings where cost basis is known. */
export function unrealizedGain(holdings: HoldingRow[]): { gain: number; hasCostBasis: boolean } {
  const withCostBasis = holdings.filter((h) => h.costBasis != null);
  if (withCostBasis.length === 0) return { gain: 0, hasCostBasis: false };
  const value = withCostBasis.reduce((s, h) => s + h.institutionValue, 0);
  const cost = withCostBasis.reduce((s, h) => s + (h.costBasis ?? 0), 0);
  return { gain: value - cost, hasCostBasis: true };
}

/**
 * §9 "Portfolio return": simple value-change-minus-contributions since the
 * earliest holdings snapshot on record. Needs at least two distinct
 * `as_of_date`s to mean anything — on a fresh install there's only today's
 * snapshot, so this reads as flat (0) until the nightly job has run a few
 * times. `hasHistory` tells the UI whether to show the number or a
 * "still building history" state.
 *
 * Net contributions come from Plaid's `transfer` investment-transaction
 * type, sign-flipped per Plaid's documented convention (positive amount =
 * cash debited from the account, e.g. a withdrawal; negative = cash
 * credited, e.g. a deposit) to read as "external money in minus money out."
 * Not verified against live Sandbox data — check this against a real
 * transfer before trusting the number in production.
 */
export async function portfolioSimpleReturn(userId: string): Promise<{ value: number; hasHistory: boolean }> {
  const accounts = await investmentAccountIds(userId);
  if (accounts.length === 0) return { value: 0, hasHistory: false };
  const accountIds = accounts.map((a) => a.id);

  const dateRows = await db
    .select({
      accountId: schema.holdings.accountId,
      minDate: sql<string>`min(${schema.holdings.asOfDate})`,
      maxDate: sql<string>`max(${schema.holdings.asOfDate})`,
    })
    .from(schema.holdings)
    .where(inArray(schema.holdings.accountId, accountIds))
    .groupBy(schema.holdings.accountId);
  if (dateRows.length === 0) return { value: 0, hasHistory: false };

  let hasHistory = false;
  let startValue = 0;
  let endValue = 0;
  let earliestDate: string | null = null;

  for (const row of dateRows) {
    if (row.minDate !== row.maxDate) hasHistory = true;
    if (!earliestDate || row.minDate < earliestDate) earliestDate = row.minDate;

    const [[startSum], [endSum]] = await Promise.all([
      db
        .select({ v: sql<number>`coalesce(sum(${schema.holdings.institutionValue}), 0)::int` })
        .from(schema.holdings)
        .where(and(eq(schema.holdings.accountId, row.accountId), eq(schema.holdings.asOfDate, row.minDate))),
      db
        .select({ v: sql<number>`coalesce(sum(${schema.holdings.institutionValue}), 0)::int` })
        .from(schema.holdings)
        .where(and(eq(schema.holdings.accountId, row.accountId), eq(schema.holdings.asOfDate, row.maxDate))),
    ]);
    startValue += startSum?.v ?? 0;
    endValue += endSum?.v ?? 0;
  }
  if (!earliestDate || !hasHistory) return { value: 0, hasHistory };

  const [contribRow] = await db
    .select({ total: sql<number>`coalesce(sum(${schema.investmentTransactions.amount}), 0)::int` })
    .from(schema.investmentTransactions)
    .where(
      and(
        inArray(schema.investmentTransactions.accountId, accountIds),
        eq(schema.investmentTransactions.type, "transfer"),
        gte(schema.investmentTransactions.date, earliestDate),
      ),
    );
  const netContributions = -(contribRow?.total ?? 0);

  return { value: computeSimpleReturn(endValue, startValue, netContributions), hasHistory };
}
