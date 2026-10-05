import { db, schema } from "@/db";
import { eq } from "drizzle-orm";
import { Landmark, CalendarCheck } from "lucide-react";
import { cn } from "@/lib/cn";
import { requireUserId } from "@/lib/session";
import { formatCents, formatPercent } from "@tally/core/money";
import { getBudgetsForMonth } from "@/lib/budgets";
import { monthRange, monthLastDay, shiftMonth, computeBurnRateProjection } from "@tally/core/budgetMath";
import { monthTotals, categoryBreakdown, upcomingBills, cashFlowTrend } from "@/lib/analytics";
import { netWorthTrend } from "@/lib/networth";
import { NET_WORTH_CURRENCY } from "@tally/core/fx";
import { trimLeadingEmptyMonths } from "@tally/core/cashFlowMath";
import { creditCardsForUser, utilizationFor } from "@/lib/liabilities";
import { latestHoldingsForUser, portfolioValue } from "@/lib/portfolio";
import { Card, CardHeader } from "@/components/ui/Card";
import { PageHeader, SyncFreshness } from "@/components/ui/PageHeader";
import { StatTile } from "@/components/ui/StatTile";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";
import { EmptyState } from "@/components/ui/EmptyState";
import { NetWorthChart } from "@/components/charts/NetWorthChart";
import { CashFlowChart } from "@/components/charts/CashFlowChart";
import { CategorySpendBar } from "@/components/charts/CategorySpendBar";
import { BudgetMeterList } from "@/components/budgets/BudgetMeterList";
import { LinkButton } from "@/components/plaid/LinkButton";
import { MOCK_MODE } from "@/lib/config";
import Link from "next/link";
import { todayFor } from "@/lib/userTimezone";

// A short, increasing entrance delay per major section so the page arrives
// in a quick cascade rather than all at once. Kept small (120ms apart) so
// it reads as "alive," not like a slow reveal you have to wait through.
function reveal(step: number): React.CSSProperties {
  return { animation: `fade-in-up 420ms ease-out ${step * 120}ms both` };
}

function pctChip(current: number, prior: number): { direction: "up" | "down"; pctLabel: string } | null {
  if (prior === 0) return null;
  const change = (current - prior) / Math.abs(prior);
  return { direction: change >= 0 ? "up" : "down", pctLabel: formatPercent(Math.abs(change)) };
}

function relativeDate(dateStr: string): string {
  const date = new Date(dateStr + "T00:00:00");
  const now = new Date();
  const sameYear = date.getFullYear() === now.getFullYear();
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: sameYear ? undefined : "numeric" });
}

function monthLabel(month: string): string {
  return new Date(month + "T00:00:00Z").toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
}

export default async function OverviewPage() {
  const userId = await requireUserId();

  const accounts = await db.query.accounts.findMany({ where: eq(schema.accounts.userId, userId) });
  const items = await db.query.plaidItems.findMany({ where: eq(schema.plaidItems.userId, userId) });

  if (accounts.length === 0) {
    return (
      <div className="max-w-[1280px] mx-auto px-4 lg:px-8 py-5 lg:py-7">
        <div className="mb-6">
          <PageHeader title="Overview" />
        </div>
        <Card className="p-12">
          <EmptyState
            icon={Landmark}
            title="Nothing connected yet"
            description="Connect a bank, credit card, or brokerage account to see your net worth, spend, and budgets here."
            action={<LinkButton mode="create" label="Connect an account" mock={MOCK_MODE} />}
          />
        </Card>
      </div>
    );
  }

  // Both in the user's timezone, so the month and day don't roll over at UTC midnight.
  const today = await todayFor(userId);
  const month = today.slice(0, 7) + "-01";
  const priorMonth = shiftMonth(month, -1);
  const { start: monthStart } = monthRange(month);
  const monthEnd = monthLastDay(month);

  const [budgets, thisMonth, lastMonth, breakdown, bills, netWorthPoints, recentTx, cards, cashFlowMonths, holdings] = await Promise.all([
    getBudgetsForMonth(userId, month),
    monthTotals(userId, month),
    monthTotals(userId, priorMonth),
    categoryBreakdown(userId, month),
    upcomingBills(userId),
    netWorthTrend(userId, 365),
    db.query.transactions.findMany({
      where: eq(schema.transactions.userId, userId),
      orderBy: (t, { desc }) => [desc(t.postedDate), desc(t.createdAt)],
      limit: 6,
    }),
    creditCardsForUser(userId),
    cashFlowTrend(userId, 12),
    latestHoldingsForUser(userId),
  ]);

  const totalAssets = accounts.filter((a) => a.type === "depository" || a.type === "investment").reduce((sum, a) => sum + (a.currentBalance ?? 0), 0);
  const totalLiabilities = accounts.filter((a) => a.type === "credit" || a.type === "loan").reduce((sum, a) => sum + (a.currentBalance ?? 0), 0);
  const netWorth = totalAssets - totalLiabilities;
  // netWorthPoints is ascending by date — walk backwards for the most recent snapshot at/before a month ago.
  // No chip at all (rather than a misleading "0%") when there's no real history to compare against yet.
  const netWorthMonthAgo = [...netWorthPoints].reverse().find((p) => p.asOfDate <= priorMonth)?.net;
  const netWorthDelta = netWorthMonthAgo != null ? pctChip(netWorth, netWorthMonthAgo) : null;

  const brokenItems = items.filter((i) => i.status !== "healthy").length;
  const utilization = await utilizationFor(cards);

  // `month` is always the current month (see todayFor() above), so "today" always falls within it.
  const daysElapsed = Number(today.slice(8, 10));
  const daysInMonth = new Date(monthEnd + "T00:00:00Z").getUTCDate();
  const projectedSpend = computeBurnRateProjection(thisMonth.spend, daysElapsed, daysInMonth);

  const spendDelta = pctChip(thisMonth.spend, lastMonth.spend);
  const incomeDelta = pctChip(thisMonth.income, lastMonth.income);
  const investmentsTotal = portfolioValue(holdings);
  // The chart drops leading months with no data (CashFlowChart), so the
  // header names the span actually shown rather than a fixed "12 months".
  const cashFlowShown = trimLeadingEmptyMonths(cashFlowMonths).length;
  const cashFlowMeta = cashFlowShown > 1 ? `Last ${cashFlowShown} months` : cashFlowShown === 1 ? "This month" : undefined;

  const totalBudgeted = budgets.reduce((s, b) => s + b.amount + b.rolloverFromPrior, 0);

  return (
    <div className="max-w-[1280px] mx-auto px-4 lg:px-8 py-5 lg:py-7 flex flex-col gap-6">
      <PageHeader
        title="Overview"
        meta={[monthLabel(month), items.some((i) => i.lastSyncedAt) && <SyncFreshness key="sync" syncedAt={items.map((i) => i.lastSyncedAt)} />]}
        actions={
          brokenItems > 0 && (
            <Link href="/accounts" className="text-[13.5px] text-negative">
              {brokenItems} connection{brokenItems === 1 ? "" : "s"} need attention →
            </Link>
          )
        }
      />

      {/* Row 1: hero net worth + connections health */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch" style={reveal(0)}>
        <Card className="lg:col-span-8 p-5 lg:p-7 flex flex-col gap-4 overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 sm:gap-12">
            <div className="flex flex-col gap-3">
              <span className="text-xs font-medium uppercase tracking-wide text-text-3">Net worth ({NET_WORTH_CURRENCY})</span>
              <AnimatedNumber cents={netWorth} className="font-display text-[40px] lg:text-[56px] leading-none text-text tabular money" />
              <div className="flex flex-wrap items-center gap-2">
                {netWorthDelta && (
                  <span className={`text-xs font-medium ${netWorthDelta.direction === "up" ? "text-positive" : "text-negative"}`}>
                    {netWorthDelta.direction === "up" ? "▲" : "▼"} {netWorthDelta.pctLabel} vs last month
                  </span>
                )}
                <span className="text-[13.5px] text-text-3">
                  {accounts.length} account{accounts.length === 1 ? "" : "s"} across {items.length} institution{items.length === 1 ? "" : "s"}
                </span>
              </div>
            </div>
            <Link href="/accounts" className="text-brand text-[15px] flex-none">
              View accounts →
            </Link>
          </div>
          {/* Full-bleed: cancels the card's side and bottom padding so the
              area runs to the card's edges (overflow-hidden above clips it
              to the rounded corners), and flex-1 lets it grow into whatever
              height the row's taller card gives it. */}
          <div className="-mx-5 -mb-5 lg:-mx-7 lg:-mb-7 flex-1 min-h-[160px] flex">
            <NetWorthChart points={netWorthPoints} />
          </div>
        </Card>

        <Card className="lg:col-span-4 flex flex-col">
          <CardHeader title="Connections" />
          <div className="flex-1 flex flex-col gap-3 p-4">
            {items.slice(0, 4).map((item) => (
              <div key={item.id} className="flex items-center justify-between text-[13.5px]">
                <span className="text-text truncate">{item.institutionName ?? "Unknown"}</span>
                <span className={cn("inline-flex items-center gap-1.5", item.status === "healthy" ? "text-positive" : "text-negative")}>
                  {item.status === "healthy" && (
                    <span className="w-1.5 h-1.5 rounded-full bg-positive flex-none" style={{ animation: "fade-dot 1.8s ease-in-out infinite" }} />
                  )}
                  {item.status === "healthy" ? "Healthy" : "Needs attention"}
                </span>
              </div>
            ))}
            <Link href="/accounts" className="text-brand text-[13.5px] mt-auto">
              Manage connections →
            </Link>
          </div>
        </Card>
      </div>

      {/* Row 2: stat tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4" style={reveal(1)}>
        <StatTile
          label="Spent this month"
          value={<AnimatedNumber cents={thisMonth.spend} />}
          delta={spendDelta ? { ...spendDelta, goodDirection: "down", comparisonLabel: "vs last month" } : undefined}
          secondary={totalBudgeted > 0 ? `${formatPercent(thisMonth.spend / totalBudgeted)} of ${formatCents(totalBudgeted)} budget` : "Projected " + formatCents(projectedSpend)}
          href={`/transactions?from=${monthStart}&to=${monthEnd}&kind=expense&transfer=0&excluded=0`}
        />
        <StatTile
          label="Income this month"
          value={<AnimatedNumber cents={thisMonth.income} className="money" />}
          delta={incomeDelta ? { ...incomeDelta, goodDirection: "up", comparisonLabel: "vs last month" } : undefined}
          href={`/transactions?from=${monthStart}&to=${monthEnd}&kind=income&transfer=0&excluded=0`}
        />
        <StatTile
          label="Investments"
          value={holdings.length > 0 ? <AnimatedNumber cents={investmentsTotal} className="money" /> : "—"}
          secondary={holdings.length > 0 ? "Portfolio value" : "No investments connected"}
          href="/investments"
        />
        <StatTile
          label="Credit utilization"
          value={utilization.utilization != null ? formatPercent(utilization.utilization) : "—"}
          secondary={
            cards.length === 0
              ? "No cards connected"
              : utilization.excludedCount > 0
                ? `${utilization.excludedCount} card${utilization.excludedCount === 1 ? "" : "s"} excluded (no limit reported)`
                : `${formatCents(utilization.totalBalance)} of ${formatCents(utilization.totalLimit)}`
          }
          href="/cards"
        />
      </div>

      {/* Cash flow trend */}
      <Card style={reveal(2)}>
        <CardHeader title="Cash flow" meta={cashFlowMeta} />
        <div className="p-4">
          <CashFlowChart months={cashFlowMonths} />
        </div>
      </Card>

      {/* Row 3: budget + where it went */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch" style={reveal(3)}>
        <Card className="lg:col-span-7 h-full">
          <CardHeader title="Budget this month" action={<Link href="/budgets" className="text-brand text-[13.5px]">Manage →</Link>} />
          <BudgetMeterList budgets={budgets} from={monthStart} to={monthEnd} daysElapsed={daysElapsed} daysInMonth={daysInMonth} />
        </Card>
        <Card className="lg:col-span-5 h-full">
          <CardHeader title="Where it went" />
          <CategorySpendBar
            rows={breakdown.map((b) => ({ ...b, href: `/transactions?category=${b.key}&from=${monthStart}&to=${monthEnd}&transfer=0&excluded=0` }))}
          />
        </Card>
      </div>

      {/* Row 4: upcoming + recent activity */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch" style={reveal(4)}>
        <Card className="lg:col-span-5 h-full flex flex-col">
          <CardHeader title="Upcoming" meta={bills.length > 0 ? `${bills.length} in the next 30 days` : undefined} />
          {bills.length === 0 ? (
            <div className="flex-1 flex items-center justify-center px-4 py-8">
              <EmptyState icon={CalendarCheck} title="Nothing due in the next 30 days." compact />
            </div>
          ) : (
            <div className="flex flex-col">
              {bills.map((bill, i) => (
                <div key={i} className="flex items-center justify-between px-4 py-3 border-b border-border last:border-b-0">
                  <div className="flex flex-col gap-0.5 min-w-0">
                    <span className="text-[15px] text-text truncate">{bill.label}</span>
                    <span className="text-xs text-text-3">{bill.dueDate}</span>
                  </div>
                  <span className="text-right text-[15px] text-text tabular">{formatCents(bill.amount)}</span>
                </div>
              ))}
            </div>
          )}
        </Card>
        <Card className="lg:col-span-7 h-full">
          <CardHeader title="Recent activity" action={<Link href="/transactions" className="text-brand text-[13.5px]">View all →</Link>} />
          <div className="flex flex-col">
            {recentTx.map((t) => (
              <div key={t.id} className="flex items-center gap-3 px-4 py-2.5 border-b border-border last:border-b-0">
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <span className="text-[15px] text-text truncate">{t.merchantName ?? t.name}</span>
                  {t.isPending && <span className="text-[11px] text-warning uppercase tracking-wide flex-none">Pending</span>}
                </div>
                <span className="font-mono text-xs text-text-3 tabular flex-none w-20 text-right whitespace-nowrap">{relativeDate(t.postedDate)}</span>
                <span className={`text-[15px] tabular flex-none w-24 text-right ${t.amount > 0 ? "text-positive" : "text-text"}`}>
                  {formatCents(t.amount, { signed: true })}
                </span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
