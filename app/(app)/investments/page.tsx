import { desc, eq, inArray } from "drizzle-orm";
import Link from "next/link";
import { TrendingUp } from "lucide-react";
import { db, schema } from "@/db";
import { requireUserId } from "@/lib/session";
import { formatCents, formatPercent } from "@/lib/money";
import { latestHoldingsForUser, portfolioValue, allocationFor, unrealizedGain, portfolioSimpleReturn, currenciesInvolved } from "@/lib/portfolio";
import { toNetWorthCurrency, NET_WORTH_CURRENCY } from "@/lib/fx";
import { Card, CardHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";

function formatQuantity(q: string): string {
  const n = parseFloat(q);
  return Number.isInteger(n) ? n.toString() : n.toFixed(4).replace(/0+$/, "").replace(/\.$/, "");
}

export default async function InvestmentsPage() {
  const userId = await requireUserId();

  const holdings = await latestHoldingsForUser(userId);
  const value = portfolioValue(holdings);
  const allocation = allocationFor(holdings);
  const gain = unrealizedGain(holdings);
  const simpleReturn = await portfolioSimpleReturn(userId);
  // Every holding above is already converted to NET_WORTH_CURRENCY
  // (lib/portfolio.ts), so this is purely informational now — which native
  // currencies these positions actually trade in, not a "can't total this"
  // warning.
  const originalCurrencies = currenciesInvolved(holdings);

  const holdingsByAccount = new Map<string, typeof holdings>();
  for (const h of holdings) {
    holdingsByAccount.set(h.accountId, [...(holdingsByAccount.get(h.accountId) ?? []), h]);
  }

  const investmentAccountIds = [...holdingsByAccount.keys()];
  const rawActivity = investmentAccountIds.length
    ? await db
        .select({
          id: schema.investmentTransactions.id,
          date: schema.investmentTransactions.date,
          name: schema.investmentTransactions.name,
          amount: schema.investmentTransactions.amount,
          currency: schema.investmentTransactions.currency,
          type: schema.investmentTransactions.type,
          subtype: schema.investmentTransactions.subtype,
          ticker: schema.securities.ticker,
        })
        .from(schema.investmentTransactions)
        .leftJoin(schema.securities, eq(schema.investmentTransactions.securityId, schema.securities.id))
        .where(inArray(schema.investmentTransactions.accountId, investmentAccountIds))
        .orderBy(desc(schema.investmentTransactions.date))
        .limit(20)
    : [];
  const activity = await Promise.all(rawActivity.map(async (tx) => ({ ...tx, amount: await toNetWorthCurrency(tx.amount, tx.currency) })));

  if (holdings.length === 0) {
    return (
      <div className="max-w-[1280px] mx-auto px-4 lg:px-8 py-5 lg:py-7 flex flex-col gap-6">
        <h1 className="text-2xl font-semibold text-text">Investments</h1>
        <Card className="p-10">
          <EmptyState
            icon={TrendingUp}
            title="Nothing invested here yet"
            description="Connect a brokerage account, or sync an existing one. Holdings usually appear within a minute."
            action={
              <Link href="/accounts" className="text-brand text-[13.5px] font-medium">
                Go to Accounts →
              </Link>
            }
          />
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-[1280px] mx-auto px-4 lg:px-8 py-5 lg:py-7 flex flex-col gap-6">
      <h1 className="text-2xl font-semibold text-text">Investments</h1>

      <Card className="flex flex-col sm:flex-row">
        <div className="flex-1 p-[18px_24px] border-b sm:border-b-0 sm:border-r border-border flex flex-col gap-2">
          <span className="text-xs font-medium uppercase tracking-wide text-text-3">Portfolio value ({NET_WORTH_CURRENCY})</span>
          <span className="font-display text-3xl text-text tabular money">{formatCents(value)}</span>
        </div>
        <div className="flex-1 p-[18px_24px] border-b sm:border-b-0 sm:border-r border-border flex flex-col gap-2">
          <span className="text-xs font-medium uppercase tracking-wide text-text-3">Unrealized gain</span>
          {gain.hasCostBasis ? (
            <span className={`font-display text-3xl tabular money ${gain.gain < 0 ? "text-negative" : "text-positive"}`}>
              {formatCents(gain.gain, { signed: true })}
            </span>
          ) : (
            <span className="text-text-3 text-[15px]">No cost basis reported</span>
          )}
          <span className="text-xs text-text-3">vs. institution-reported cost basis</span>
        </div>
        <div className="flex-1 p-[18px_24px] flex flex-col gap-2">
          <span className="text-xs font-medium uppercase tracking-wide text-text-3">Simple return</span>
          {simpleReturn.hasHistory ? (
            <span className={`font-display text-3xl tabular money ${simpleReturn.value < 0 ? "text-negative" : "text-positive"}`}>
              {formatCents(simpleReturn.value, { signed: true })}
            </span>
          ) : (
            <span className="text-text-3 text-[15px]">Building history…</span>
          )}
          <span className="text-xs text-text-3">Value change minus contributions (not IRR/TWR)</span>
        </div>
      </Card>

      {originalCurrencies.length > 1 && (
        <p className="text-xs text-text-3 -mt-2">
          Holdings span {originalCurrencies.join(", ")}, converted to {NET_WORTH_CURRENCY} above at today's rate.
        </p>
      )}

      <Card>
        <CardHeader title="Allocation" />
        <div className="p-4 flex flex-col gap-3">
          <div className="h-3 rounded-full overflow-hidden flex bg-sunken">
            {allocation.map((slice, i) => (
              <div key={slice.label} style={{ width: `${slice.pct * 100}%`, background: `var(--series-${(i % 8) + 1})` }} />
            ))}
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            {allocation.map((slice, i) => (
              <div key={slice.label} className="flex items-center gap-2 text-[13.5px]">
                <span className="w-2 h-2 rounded-full flex-none" style={{ background: `var(--series-${(i % 8) + 1})` }} />
                <span className="text-text">{slice.label}</span>
                <span className="text-text-3 tabular">{formatPercent(slice.pct)}</span>
              </div>
            ))}
          </div>
        </div>
      </Card>

      {[...holdingsByAccount.entries()].map(([accountId, accountHoldings]) => {
        return (
          <Card key={accountId} className="overflow-hidden">
            <CardHeader
              title={accountHoldings[0]?.accountName ?? "Account"}
              meta={`${formatCents(accountHoldings.reduce((s, h) => s + h.institutionValue, 0))} ${NET_WORTH_CURRENCY}`}
              metaIsMoney
            />
            <div className="overflow-x-auto">
              <div className="grid grid-cols-[100px_minmax(180px,1fr)_120px_120px_150px] gap-3 items-center px-4 py-2.5 bg-surface-2 border-b border-border text-xs font-medium uppercase tracking-wide text-text-3 min-w-[680px]">
                <span>Ticker</span>
                <span>Name</span>
                <span className="text-right">Quantity</span>
                <span className="text-right">Price</span>
                <span className="text-right">Value</span>
              </div>
              {accountHoldings.map((h) => (
                <div key={h.securityId} className="grid grid-cols-[100px_minmax(180px,1fr)_120px_120px_150px] gap-3 items-center px-4 py-2.5 border-b border-border last:border-b-0 min-w-[680px]">
                  <span className="font-mono text-[13.5px] text-text">{h.ticker ?? "—"}</span>
                  <span className="text-[15px] text-text truncate">{h.securityName ?? "Unknown security"}</span>
                  <span className="text-right text-[13.5px] text-text-2 tabular">{formatQuantity(h.quantity)}</span>
                  <span className="text-right text-[13.5px] text-text-2 tabular money">
                    {h.institutionValue != null && parseFloat(h.quantity) > 0
                      ? formatCents(Math.round(h.institutionValue / parseFloat(h.quantity)))
                      : "—"}
                  </span>
                  <div className="flex flex-col items-end gap-0.5">
                    <span className="text-right text-[15px] text-text tabular money">{formatCents(h.institutionValue)}</span>
                    <span className="text-right text-[11px] text-text-3">
                      {h.currency}
                      {h.originalCurrency !== h.currency && ` (${h.originalCurrency})`}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        );
      })}

      {activity.length > 0 && (
        <Card>
          <CardHeader title="Recent activity" />
          {activity.map((tx) => (
            <div key={tx.id} className="flex items-center gap-3 px-4 py-2.5 border-b border-border last:border-b-0">
              <span className="font-mono text-[13px] text-text-3 tabular w-24 flex-none">{tx.date}</span>
              <span className="text-[15px] text-text flex-1 min-w-0 truncate">
                {tx.name}
                {tx.ticker && <span className="text-text-3"> · {tx.ticker}</span>}
              </span>
              <span className="text-xs text-text-3">{tx.subtype}</span>
              <span className={`text-[15px] tabular money ${tx.amount < 0 ? "text-positive" : "text-text"}`}>{formatCents(tx.amount, { signed: true })}</span>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
