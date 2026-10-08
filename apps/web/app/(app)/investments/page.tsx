import { and, desc, eq, inArray } from "drizzle-orm";
import { TrendingUp } from "lucide-react";
import { db, schema } from "@/db";
import { requireUserId } from "@/lib/session";
import { latestHoldingsForUser, portfolioHistory, currenciesInvolved } from "@/lib/portfolio";
import { toNetWorthCurrency, NET_WORTH_CURRENCY } from "@tally/core/fx";
import { accountDisplayName } from "@tally/core/accountName";
import { Card } from "@/components/ui/Card";
import { PageHeader, SyncFreshness } from "@/components/ui/PageHeader";
import { SyncButton } from "@/components/plaid/SyncButton";
import { SyncFailureBanner } from "@/components/plaid/SyncFailureBanner";
import { LinkButton } from "@/components/plaid/LinkButton";
import { InvestmentsView } from "@/components/investments/InvestmentsView";
import type { ActivityView, InvestmentConnection } from "@/components/investments/types";
import { itemStatusToBadge } from "@/lib/freshness";
import { todayFor } from "@/lib/userTimezone";
import { MOCK_MODE } from "@/lib/config";

/** Recent investment transactions loaded for the activity list and holding panel. */
const ACTIVITY_LIMIT = 200;

export default async function InvestmentsPage({ searchParams }: { searchParams: Promise<{ holding?: string }> }) {
  const userId = await requireUserId();
  const { holding } = await searchParams;
  const [holdings, history, today] = await Promise.all([latestHoldingsForUser(userId), portfolioHistory(userId), todayFor(userId)]);

  if (holdings.length === 0) {
    return (
      <div className="max-w-[1280px] mx-auto px-4 lg:px-8 py-5 lg:py-7 flex flex-col gap-6">
        <PageHeader title="Investments" />
        <Card className="p-8 lg:p-10 flex flex-col items-start gap-4 max-w-[640px]">
          <span className="w-11 h-11 rounded-[12px] bg-brand-subtle text-brand flex items-center justify-center">
            <TrendingUp size={20} strokeWidth={1.75} />
          </span>
          <h2 className="m-0 font-display text-[28px] font-normal text-text">Track your investments</h2>
          <p className="m-0 text-[15px] leading-relaxed text-text-2 max-w-[52ch]">
            Connect a brokerage like Wealthsimple or Questrade to see your TFSA, RRSP and FHSA in one place, with growth over time.
          </p>
          <LinkButton mode="create" label="Connect a brokerage" mock={MOCK_MODE} />
        </Card>
      </div>
    );
  }

  const accountIds = [...new Set(holdings.map((h) => h.accountId))];
  const itemIds = [...new Set(holdings.map((h) => h.itemId).filter((id): id is string => !!id))];

  const [accountRows, rawActivity, items, runs] = await Promise.all([
    db.select({ id: schema.accounts.id, name: schema.accounts.name, nickname: schema.accounts.nickname }).from(schema.accounts).where(inArray(schema.accounts.id, accountIds)),
    db
      .select({
        id: schema.investmentTransactions.id,
        accountId: schema.investmentTransactions.accountId,
        securityId: schema.investmentTransactions.securityId,
        date: schema.investmentTransactions.date,
        name: schema.investmentTransactions.name,
        quantity: schema.investmentTransactions.quantity,
        amount: schema.investmentTransactions.amount,
        price: schema.investmentTransactions.price,
        currency: schema.investmentTransactions.currency,
        type: schema.investmentTransactions.type,
        subtype: schema.investmentTransactions.subtype,
        ticker: schema.securities.ticker,
        securityName: schema.securities.name,
      })
      .from(schema.investmentTransactions)
      .leftJoin(schema.securities, eq(schema.investmentTransactions.securityId, schema.securities.id))
      .where(inArray(schema.investmentTransactions.accountId, accountIds))
      .orderBy(desc(schema.investmentTransactions.date))
      .limit(ACTIVITY_LIMIT),
    itemIds.length ? db.query.plaidItems.findMany({ where: and(eq(schema.plaidItems.userId, userId), inArray(schema.plaidItems.id, itemIds)) }) : [],
    itemIds.length
      ? db
          .select({ itemId: schema.syncRuns.itemId, trigger: schema.syncRuns.trigger, error: schema.syncRuns.error })
          .from(schema.syncRuns)
          .where(inArray(schema.syncRuns.itemId, itemIds))
          .orderBy(desc(schema.syncRuns.startedAt))
          .limit(itemIds.length * 20)
      : [],
  ]);

  const accountName = new Map(accountRows.map((a) => [a.id, accountDisplayName(a.name, a.nickname)]));
  const activity: ActivityView[] = await Promise.all(
    rawActivity.map(async (t) => ({
      id: t.id,
      date: t.date,
      accountId: t.accountId,
      accountName: accountName.get(t.accountId) ?? "",
      securityId: t.securityId,
      type: t.type,
      subtype: t.subtype,
      name: t.name,
      ticker: t.ticker,
      securityName: t.securityName,
      quantity: t.quantity,
      amount: await toNetWorthCurrency(t.amount, t.currency),
      price: t.price != null ? await toNetWorthCurrency(t.price, t.currency) : null,
    })),
  );

  const connections: InvestmentConnection[] = items.map((i) => ({
    id: i.id,
    institutionName: i.institutionName,
    status: i.status,
    lastSyncedAt: i.lastSyncedAt?.toISOString() ?? null,
    badge: itemStatusToBadge(i.status, i.lastSyncedAt, i.transactionsUpdateStatus),
  }));
  // Same "a manual retry already failed" escalation the Accounts page uses.
  const serverRefreshFailed = itemIds.filter((id) => runs.find((r) => r.itemId === id && r.trigger === "manual")?.error);
  const originalCurrencies = currenciesInvolved(holdings);

  return (
    <div className="max-w-[1280px] mx-auto px-4 lg:px-8 py-5 lg:py-7 flex flex-col gap-6">
      <PageHeader
        title="Investments"
        meta={[
          `${new Set(holdings.map((h) => h.securityId)).size} holdings`,
          `${accountIds.length} account${accountIds.length === 1 ? "" : "s"}`,
          items.some((i) => i.lastSyncedAt) && <SyncFreshness key="sync" syncedAt={items.map((i) => i.lastSyncedAt)} />,
          originalCurrencies.some((c) => c !== NET_WORTH_CURRENCY) && `${originalCurrencies.filter((c) => c !== NET_WORTH_CURRENCY).join(", ")} converted to ${NET_WORTH_CURRENCY} at today's rate`,
        ]}
        actions={<SyncButton products={["holdings", "investments"]} label="Sync holdings" />}
      />

      <SyncFailureBanner />

      <InvestmentsView
        holdings={holdings}
        history={history}
        activity={activity}
        connections={connections}
        serverRefreshFailed={serverRefreshFailed}
        today={today}
        baseCurrency={NET_WORTH_CURRENCY}
        initialHoldingId={holding ?? null}
      />
    </div>
  );
}
