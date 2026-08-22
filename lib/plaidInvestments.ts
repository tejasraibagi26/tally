import { eq, inArray } from "drizzle-orm";
import { db, schema } from "@/db";
import { plaidClient, getAccessToken, plaidErrorCode } from "@/lib/plaid";
import { isMockPlaidItemId } from "@/lib/mock/isMock";
import { seedMockHoldingsForItem, seedMockInvestmentTransactionsForItem } from "@/lib/mock/seedInvestments";
import { recordSyncRun } from "@/lib/syncRuns";
import type { SyncTrigger } from "@/lib/plaidSync";
import type { Holding, InvestmentTransaction, Security } from "plaid";

// §6.4 coverage reality: not every institution supports Investments, and
// some are holdings-only. These codes mean "nothing to sync here", not
// "something broke" — recorded as a quiet skip, never a sync_runs error.
const NOT_SUPPORTED_CODES = new Set(["NO_INVESTMENT_ACCOUNTS", "PRODUCTS_NOT_SUPPORTED", "PRODUCT_NOT_ENABLED"]);

async function upsertSecurities(securities: Security[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  for (const sec of securities) {
    const [row] = await db
      .insert(schema.securities)
      .values({
        plaidSecurityId: sec.security_id,
        ticker: sec.ticker_symbol,
        cusip: sec.cusip,
        isin: sec.isin,
        name: sec.name,
        type: sec.type,
        isCashEquivalent: sec.is_cash_equivalent ?? false,
        closePrice: sec.close_price != null ? Math.round(sec.close_price * 100) : null,
        closePriceAsOf: sec.close_price_as_of ?? null,
        currency: sec.iso_currency_code ?? sec.unofficial_currency_code ?? "USD",
        sector: sec.sector,
      })
      .onConflictDoUpdate({
        target: schema.securities.plaidSecurityId,
        set: {
          name: sec.name,
          type: sec.type,
          closePrice: sec.close_price != null ? Math.round(sec.close_price * 100) : null,
          closePriceAsOf: sec.close_price_as_of ?? null,
          sector: sec.sector,
        },
      })
      .returning({ id: schema.securities.id, plaidSecurityId: schema.securities.plaidSecurityId });
    if (row) map.set(row.plaidSecurityId!, row.id);
  }
  return map;
}

async function accountIdsByPlaidId(plaidAccountIds: string[]): Promise<Map<string, string>> {
  if (plaidAccountIds.length === 0) return new Map();
  const rows = await db
    .select({ id: schema.accounts.id, plaidAccountId: schema.accounts.plaidAccountId })
    .from(schema.accounts)
    .where(inArray(schema.accounts.plaidAccountId, plaidAccountIds));
  return new Map(rows.map((r) => [r.plaidAccountId!, r.id]));
}

/** Upserts today's holdings snapshot (§6.4) — a dated row per (account, security), never overwritten across days. */
export async function syncHoldingsForItem(itemId: string, trigger: SyncTrigger): Promise<void> {
  const startedAt = new Date();
  const [item] = await db.select().from(schema.plaidItems).where(eq(schema.plaidItems.id, itemId)).limit(1);
  if (!item) return;

  try {
    if (isMockPlaidItemId(item.plaidItemId)) {
      await seedMockHoldingsForItem(itemId);
      await recordSyncRun(itemId, "holdings", trigger, startedAt, {});
      return;
    }

    const accessToken = await getAccessToken(itemId);
    const res = await plaidClient.investmentsHoldingsGet({ access_token: accessToken });
    await reconcileHoldings(res.data.securities, res.data.holdings);
    await recordSyncRun(itemId, "holdings", trigger, startedAt, { added: res.data.holdings.length });
  } catch (err) {
    const code = plaidErrorCode(err);
    if (code && NOT_SUPPORTED_CODES.has(code)) return; // not a failure — nothing to sync here (§6.4)
    console.error(`Holdings sync failed for item ${itemId}`, err);
    await recordSyncRun(itemId, "holdings", trigger, startedAt, { error: err instanceof Error ? err.message : "unknown error" });
    throw err; // rethrow so the queue worker retries (§8.2) — only the "not supported" branch above is a true no-op
  }
}

async function reconcileHoldings(securities: Security[], holdings: Holding[]): Promise<void> {
  if (holdings.length === 0) return;
  const securityIdByPlaidId = await upsertSecurities(securities);
  const acctIdByPlaidId = await accountIdsByPlaidId([...new Set(holdings.map((h) => h.account_id))]);
  const today = new Date().toISOString().slice(0, 10);

  for (const h of holdings) {
    const accountId = acctIdByPlaidId.get(h.account_id);
    const securityId = securityIdByPlaidId.get(h.security_id);
    if (!accountId || !securityId) continue;

    await db
      .insert(schema.holdings)
      .values({
        accountId,
        securityId,
        quantity: String(h.quantity),
        costBasis: h.cost_basis != null ? Math.round(h.cost_basis * 100) : null,
        institutionPrice: Math.round(h.institution_price * 100),
        institutionPriceAsOf: h.institution_price_as_of ?? null,
        institutionValue: Math.round(h.institution_value * 100),
        asOfDate: today,
      })
      .onConflictDoUpdate({
        target: [schema.holdings.accountId, schema.holdings.securityId, schema.holdings.asOfDate],
        set: {
          quantity: String(h.quantity),
          costBasis: h.cost_basis != null ? Math.round(h.cost_basis * 100) : null,
          institutionPrice: Math.round(h.institution_price * 100),
          institutionPriceAsOf: h.institution_price_as_of ?? null,
          institutionValue: Math.round(h.institution_value * 100),
        },
      });
  }
}

const HISTORY_LOOKBACK_DAYS = 730; // ~24 months, matching the transactions history window (§6.3)

/** No cursor for this endpoint (unlike /transactions/sync) — pages the full lookback window every run; upsert-by-id keeps re-fetches idempotent. */
export async function syncInvestmentTransactionsForItem(itemId: string, trigger: SyncTrigger): Promise<void> {
  const startedAt = new Date();
  const [item] = await db.select().from(schema.plaidItems).where(eq(schema.plaidItems.id, itemId)).limit(1);
  if (!item) return;

  try {
    if (isMockPlaidItemId(item.plaidItemId)) {
      await seedMockInvestmentTransactionsForItem(itemId);
      await recordSyncRun(itemId, "inv_tx", trigger, startedAt, {});
      return;
    }

    const accessToken = await getAccessToken(itemId);
    const endDate = new Date().toISOString().slice(0, 10);
    const startDate = new Date(Date.now() - HISTORY_LOOKBACK_DAYS * 86_400_000).toISOString().slice(0, 10);

    const all: InvestmentTransaction[] = [];
    const allSecurities: Security[] = [];
    let offset = 0;
    const count = 500;
    let total = Infinity;

    while (offset < total) {
      const res = await plaidClient.investmentsTransactionsGet({
        access_token: accessToken,
        start_date: startDate,
        end_date: endDate,
        options: { count, offset },
      });
      all.push(...res.data.investment_transactions);
      allSecurities.push(...res.data.securities);
      total = res.data.total_investment_transactions;
      if (res.data.investment_transactions.length === 0) break; // safety against an off-by-one infinite loop
      offset += res.data.investment_transactions.length;
    }

    await reconcileInvestmentTransactions(allSecurities, all);
    await recordSyncRun(itemId, "inv_tx", trigger, startedAt, { added: all.length });
  } catch (err) {
    const code = plaidErrorCode(err);
    if (code && NOT_SUPPORTED_CODES.has(code)) return; // not a failure — nothing to sync here (§6.4)
    console.error(`Investment transaction sync failed for item ${itemId}`, err);
    await recordSyncRun(itemId, "inv_tx", trigger, startedAt, { error: err instanceof Error ? err.message : "unknown error" });
    throw err; // rethrow so the queue worker retries (§8.2)
  }
}

async function reconcileInvestmentTransactions(securities: Security[], rows: InvestmentTransaction[]): Promise<void> {
  if (rows.length === 0) return;
  const securityIdByPlaidId = await upsertSecurities(securities);
  const acctIdByPlaidId = await accountIdsByPlaidId([...new Set(rows.map((r) => r.account_id))]);

  for (const r of rows) {
    const accountId = acctIdByPlaidId.get(r.account_id);
    if (!accountId) continue;
    const securityId = r.security_id ? (securityIdByPlaidId.get(r.security_id) ?? null) : null;

    await db
      .insert(schema.investmentTransactions)
      .values({
        accountId,
        plaidInvestmentTransactionId: r.investment_transaction_id,
        securityId,
        date: r.date,
        name: r.name,
        quantity: String(r.quantity),
        amount: Math.round(r.amount * 100),
        price: Math.round(r.price * 100),
        fees: r.fees != null ? Math.round(r.fees * 100) : null,
        type: r.type,
        subtype: r.subtype,
        currency: r.iso_currency_code ?? r.unofficial_currency_code ?? "USD",
      })
      .onConflictDoNothing({ target: schema.investmentTransactions.plaidInvestmentTransactionId });
  }
}
