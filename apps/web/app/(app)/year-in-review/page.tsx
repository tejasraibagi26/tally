import Link from "next/link";
import { requireUserId } from "@/lib/session";
import { todayFor } from "@/lib/userTimezone";
import { yearReviewFor } from "@/lib/yearReview";
import { formatCents, formatPercent } from "@tally/core/money";
import { latestCompleteYear, yearTitle } from "@tally/core/yearReview";
import { Card, CardHeader } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { cn } from "@/lib/cn";

function shortDate(date: string): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

/** A figure "hide amounts" masks (net worth, income, savings: the same set as Overview). */
function M({ cents, signed }: { cents: number; signed?: boolean }) {
  return (
    <span className="money money-fit">
      <span>{formatCents(cents, { signed })}</span>
    </span>
  );
}

function Tile({ label, children, sub, href }: { label: string; children: React.ReactNode; sub?: React.ReactNode; href?: string }) {
  const body = (
    <>
      <span className="text-xs font-medium uppercase tracking-wide text-text-3">{label}</span>
      <span className="ui-figure font-display text-[30px] leading-none text-text tabular">{children}</span>
      {sub && <span className="text-[13px] text-text-2">{sub}</span>}
    </>
  );
  const cls = "bg-surface border border-border rounded-card shadow-raised p-5 flex flex-col gap-2";
  return href ? (
    <Link href={href} className={cn(cls, "hover:border-border-strong transition-colors")}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

/**
 * Year in review (?year=2025 for a past one): net worth over the year,
 * money in and out, spend month by month, where it went, and the months
 * that stood out -- all from data Tally already has (lib/yearReview.ts).
 */
export default async function YearInReviewPage({ searchParams }: { searchParams: Promise<{ year?: string }> }) {
  const userId = await requireUserId();
  const today = await todayFor(userId);
  // Whole years only: the year still running isn't a review yet.
  const lastYear = latestCompleteYear(today);
  const asked = Number((await searchParams).year);
  const year = Number.isInteger(asked) && asked >= 2000 && asked <= lastYear ? asked : lastYear;
  const r = await yearReviewFor(userId, year);

  const maxSpend = Math.max(1, ...r.months.map((m) => m.spend));
  const yearRange = `from=${year}-01-01&to=${year}-12-31`;

  return (
    <div className="max-w-[1080px] mx-auto px-4 lg:px-8 py-5 lg:py-7 flex flex-col gap-6">
      <PageHeader
        title={`Your ${yearTitle(r)}`}
        meta={[
          r.inProgress ? `Jan 1 – ${shortDate(today)}` : `Jan 1 – Dec 31`,
          `${r.transactionCount.toLocaleString("en-US")} transactions`,
          <span key="years" className="inline-flex gap-3">
            <Link href={`/year-in-review?year=${year - 1}`} className="text-brand">
              ← {year - 1}
            </Link>
            {year < lastYear && (
              <Link href={`/year-in-review?year=${year + 1}`} className="text-brand">
                {year + 1} →
              </Link>
            )}
          </span>,
        ]}
      />

      {r.months.length === 0 ? (
        <Card className="p-10 text-center text-text-2 text-[15px]">Nothing recorded for {year}.</Card>
      ) : (
        <>
          {/* Net worth over the year, on Pop's brand card. */}
          <Card className="ui-hero p-6 lg:p-8 flex flex-col gap-3">
            <span className="text-xs font-medium uppercase tracking-wide text-text-3">Net worth {r.inProgress ? "so far this year" : `in ${year}`}</span>
            {r.netWorth ? (
              <>
                <span className={cn("font-display text-[44px] lg:text-[60px] leading-none tabular", r.netWorth.change >= 0 ? "text-text" : "text-negative")}>
                  <M cents={r.netWorth.change} signed />
                </span>
                <span className="text-[15px] text-text-2">
                  From <M cents={r.netWorth.start} /> {r.netWorth.fromJan1 ? "on Jan 1" : `on ${shortDate(r.netWorth.startDate)}, when tracking began,`} to <M cents={r.netWorth.now} />.
                </span>
              </>
            ) : (
              <span className="text-[15px] text-text-2">No net worth history for {year} yet.</span>
            )}
          </Card>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Tile label="Money in" href={`/transactions?${yearRange}&kind=income&transfer=0&excluded=0`}>
              <M cents={r.income} />
            </Tile>
            <Tile label="Money out" sub={r.averageMonthlySpend > 0 ? `About ${formatCents(r.averageMonthlySpend)} a month` : undefined} href={`/transactions?${yearRange}&kind=expense&transfer=0&excluded=0`}>
              {formatCents(r.spend)}
            </Tile>
            <Tile label={r.saved >= 0 ? "Saved" : "Spent more than came in"} sub={r.savingsRate != null && r.saved >= 0 ? `${formatPercent(r.savingsRate)} of what came in` : undefined}>
              <M cents={Math.abs(r.saved)} />
            </Tile>
          </div>

          <Card className="overflow-hidden">
            <CardHeader title="Month by month" meta="Spend" />
            {/* Bars run edge to edge; labels stay padded under them. */}
            <div className="flex items-end gap-[3px] h-[200px] pt-4">
              {r.months.map((m) => {
                const top = r.biggestMonth?.month === m.month;
                return (
                  <Link
                    key={m.month}
                    href={`/transactions?from=${m.month}&to=${m.month.slice(0, 8)}${new Date(Date.UTC(year, Number(m.month.slice(5, 7)), 0)).getUTCDate()}&kind=expense&transfer=0&excluded=0`}
                    title={`${m.label}: ${formatCents(m.spend)}`}
                    className="flex-1 h-full flex items-end hover:opacity-80"
                  >
                    <span className="w-full rounded-t-[6px]" style={{ height: `${Math.max(2, (m.spend / maxSpend) * 100)}%`, background: top ? "var(--marigold, var(--warning))" : "var(--series-1)" }} />
                  </Link>
                );
              })}
              {Array.from({ length: 12 - r.months.length }, (_, i) => (
                <span key={`rest-${i}`} className="flex-1" aria-hidden="true" />
              ))}
            </div>
            <div className="flex gap-[3px] px-1 py-2 border-t border-border">
              {Array.from({ length: 12 }, (_, i) => (
                <span key={i} className="flex-1 text-center text-[11.5px] text-text-3">
                  {new Date(Date.UTC(year, i, 1)).toLocaleDateString("en-US", { month: "narrow", timeZone: "UTC" })}
                </span>
              ))}
            </div>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader title="Where it went" />
              <ul className="m-0 p-5 list-none flex flex-col gap-3.5">
                {r.topCategories.map((c, i) => (
                  <li key={c.key} className="flex flex-col gap-1.5">
                    <span className="flex justify-between text-[14px]">
                      <span className="text-text">{c.label}</span>
                      <span className="text-text tabular">
                        {formatCents(c.total)} <span className="text-text-3">· {formatPercent(c.share)}</span>
                      </span>
                    </span>
                    <span className="ui-meter h-2 rounded-full bg-sunken overflow-hidden">
                      <span className="block h-full rounded-full" style={{ width: `${c.share * 100}%`, background: `var(--series-${(i % 8) + 1})` }} />
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
            <Card>
              <CardHeader title="Top places" />
              <ul className="m-0 p-5 list-none flex flex-col gap-3">
                {r.topMerchants.map((m, i) => (
                  <li key={m.key} className="flex items-center gap-3 text-[14px]">
                    <span className="ui-tile w-8 h-8 rounded-control bg-sunken flex items-center justify-center font-display text-[15px] text-text flex-none">{i + 1}</span>
                    <span className="flex flex-col min-w-0 flex-1">
                      <span className="text-text truncate">{m.label}</span>
                      {m.count != null && <span className="text-[12.5px] text-text-3">{m.count} time{m.count === 1 ? "" : "s"}</span>}
                    </span>
                    <span className="text-text tabular">{formatCents(m.total)}</span>
                  </li>
                ))}
              </ul>
            </Card>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Tile label="Biggest month" sub={r.biggestMonth ? `${formatCents(r.biggestMonth.spend)} spent` : "Once a month has finished"}>
              {r.biggestMonth?.label ?? "—"}
            </Tile>
            <Tile label="Calmest month" sub={r.calmestMonth ? `${formatCents(r.calmestMonth.spend)} spent` : "Once two months have finished"}>
              {r.calmestMonth?.label ?? "—"}
            </Tile>
            <Tile label="Subscriptions" sub={`${r.subscriptions.activeCount} active, at today's prices`} href="/subscriptions">
              {formatCents(r.subscriptions.yearlyTotal)}
              <span className="text-[15px] font-sans text-text-2"> a year</span>
            </Tile>
          </div>
        </>
      )}
    </div>
  );
}
