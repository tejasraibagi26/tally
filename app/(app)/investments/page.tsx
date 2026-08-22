import { desc, eq, inArray } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireUserId } from "@/lib/session";
import { formatCents, formatPercent } from "@/lib/money";
import { latestHoldingsForUser, portfolioValue, allocationFor, unrealizedGain, portfolioSimpleReturn } from "@/lib/portfolio";
import { Card, CardHeader } from "@/components/ui/Card";

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

  const holdingsByAccount = new Map<string, typeof holdings>();
  for (const h of holdings) {
    holdingsByAccount.set(h.accountId, [...(holdingsByAccount.get(h.accountId) ?? []), h]);
  }

  const investmentAccountIds = [...holdingsByAccount.keys()];
  const activity = investmentAccountIds.length
    ? await db
        .select({
          id: schema.investmentTransactions.id,
          date: schema.investmentTransactions.date,
          name: schema.investmentTransactions.name,
          amount: schema.investmentTransactions.amount,
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

  if (holdings.length === 0) {
    return (
      <div className="max-w-[1280px] mx-auto px-8 py-7 flex flex-col gap-6">
        <h1 className="text-2xl font-semibold text-text">Investments</h1>
        <Card className="p-10 flex flex-col items-center gap-2 text-center">
          <span className="font-display text-2xl text-text">No holdings yet</span>
          <p className="text-text-2 text-[15px]">
            Connect a brokerage account, or sync an existing one — holdings usually appear within a minute.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-[1280px] mx-auto px-8 py-7 flex flex-col gap-6">
      <h1 className="text-2xl font-semibold text-text">Investments</h1>

      <Card className="flex">
        <div className="flex-1 p-[18px_24px] border-r border-border flex flex-col gap-2">
          <span className="text-xs font-medium uppercase tracking-wide text-text-3">Portfolio value</span>
          <span className="font-display text-3xl text-text tabular">{formatCents(value)}</span>
        </div>
        <div className="flex-1 p-[18px_24px] border-r border-border flex flex-col gap-2">
          <span className="text-xs font-medium uppercase tracking-wide text-text-3">Unrealized gain</span>
          {gain.hasCostBasis ? (
            <span className={`font-display text-3xl tabular ${gain.gain < 0 ? "text-negative" : "text-positive"}`}>
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
            <span className={`font-display text-3xl tabular ${simpleReturn.value < 0 ? "text-negative" : "text-positive"}`}>
              {formatCents(simpleReturn.value, { signed: true })}
            </span>
          ) : (
            <span className="text-text-3 text-[15px]">Building history…</span>
          )}
          <span className="text-xs text-text-3">Value change minus contributions — not IRR/TWR</span>
        </div>
      </Card>

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

      {[...holdingsByAccount.entries()].map(([accountId, accountHoldings]) => (
        <Card key={accountId}>
          <CardHeader title={accountHoldings[0]?.accountName ?? "Account"} meta={formatCents(accountHoldings.reduce((s, h) => s + h.institutionValue, 0))} />
          <div className="grid grid-cols-[100px_minmax(180px,1fr)_120px_120px_140px] gap-3 items-center px-4 py-2.5 bg-surface-2 border-b border-border text-xs font-medium uppercase tracking-wide text-text-3">
            <span>Ticker</span>
            <span>Name</span>
            <span className="text-right">Quantity</span>
            <span className="text-right">Price</span>
            <span className="text-right">Value</span>
          </div>
          {accountHoldings.map((h) => (
            <div key={h.securityId} className="grid grid-cols-[100px_minmax(180px,1fr)_120px_120px_140px] gap-3 items-center px-4 py-2.5 border-b border-border last:border-b-0">
              <span className="font-mono text-[13.5px] text-text">{h.ticker ?? "—"}</span>
              <span className="text-[15px] text-text truncate">{h.securityName ?? "Unknown security"}</span>
              <span className="text-right text-[13.5px] text-text-2 tabular">{formatQuantity(h.quantity)}</span>
              <span className="text-right text-[13.5px] text-text-2 tabular">
                {h.institutionValue != null && parseFloat(h.quantity) > 0
                  ? formatCents(Math.round(h.institutionValue / parseFloat(h.quantity)))
                  : "—"}
              </span>
              <span className="text-right text-[15px] text-text tabular">{formatCents(h.institutionValue)}</span>
            </div>
          ))}
        </Card>
      ))}

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
              <span className={`text-[15px] tabular ${tx.amount < 0 ? "text-positive" : "text-text"}`}>{formatCents(tx.amount, { signed: true })}</span>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
