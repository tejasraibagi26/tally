import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { requireUserId } from "@/lib/session";
import { forecastFor } from "@/lib/forecast";
import { formatCents } from "@tally/core/money";
import { Card, CardHeader } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { ForecastAssumptions } from "@/components/forecast/ForecastAssumptions";
import { ForecastChart, type ForecastChartPoint } from "@/components/forecast/ForecastChart";
import { ForecastHowItWorks } from "@/components/forecast/ForecastHowItWorks";
import { ForecastLedger } from "@/components/forecast/ForecastLedger";
import { ForecastRange } from "@/components/forecast/ForecastRange";

export const metadata = { title: "Forecast · Tally" };

const longDate = (date: string) =>
  new Date(`${date}T00:00:00Z`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });

function daysAway(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

/**
 * Forecast (Tally Pop and classic alike): the projected cash balance for
 * the next 30-90 days, the first day it crosses the buffer, and the ledger
 * behind it. Reads only — a wrong bill is fixed in Subscriptions, a wrong
 * payday in Income; a view that quietly writes is a view people stop
 * trusting.
 */
export default async function ForecastPage({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  const userId = await requireUserId();
  const { days } = await searchParams;
  const f = await forecastFor(userId, days == null ? undefined : Number(days));

  if (f.openingCash === 0 && f.assumptions.paycheques === 0) {
    return (
      <div className="mx-auto flex max-w-[1080px] flex-col gap-6 px-4 py-5 lg:px-8 lg:py-7">
        <PageHeader title="Forecast" meta={["Where your balance is heading"]} actions={<ForecastHowItWorks />} />
        <Card className="p-6 lg:p-7">
          <h2 className="ui-card-title m-0 text-xl font-semibold text-text">Nothing to forecast yet</h2>
          <p className="mb-0 mt-2 max-w-[52ch] text-[15px] leading-relaxed text-text-2">
            Tally needs a chequing account to start from. Connect one and your bills, pay dates and card statements fill in the rest.
          </p>
          <Link href="/accounts" className="ui-btn ui-btn-primary mt-4 inline-flex rounded-full bg-brand px-4 py-2 text-[14px] font-semibold text-on-brand">
            Connect an account
          </Link>
        </Card>
      </div>
    );
  }

  const points: ForecastChartPoint[] = f.days.map((d) => ({
    ...d,
    range: [d.lo, d.hi],
    events: f.events.filter((e) => (e.date < f.today ? f.today : e.date) === d.date),
  }));

  const h = f.headline;
  const short = h?.kind === "shortfall";
  const out = h ? daysAway(f.today, h.date) : 0;

  return (
    <div className="mx-auto flex max-w-[1080px] flex-col gap-6 px-4 py-5 lg:px-8 lg:py-7">
      <PageHeader
        title="Forecast"
        meta={[`Next ${f.range} days`, f.assumptions.stale.length > 0 ? "balances are out of date" : "spending accounts only"]}
        actions={
          <div className="flex items-center gap-2">
            <ForecastRange value={f.range} />
            <ForecastHowItWorks />
          </div>
        }
      />

      {/* Headline: the first day under the buffer, not the deepest — it is the
          one still worth acting on — and always with what caused it. */}
      <Card className={short ? "ui-card-negative p-5 lg:p-6" : "p-5 lg:p-6"}>
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.5fr)_1px_repeat(3,minmax(0,0.75fr))] lg:items-center">
          <div>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-text-2">
              {h == null ? "Your balance" : short ? "First short day" : "Lowest point"}
            </span>
            {h == null ? (
              <>
                <p className="mb-0 mt-2 max-w-[46ch] text-[15px] leading-relaxed text-text-2">
                  Tally can plot your bills, but not where you land without knowing when you get paid.
                </p>
                <Link href="/settings#income" className="ui-btn ui-btn-primary mt-3 inline-flex rounded-full bg-brand px-3.5 py-1.5 text-[13.5px] font-semibold text-on-brand">
                  Set your pay schedule
                </Link>
              </>
            ) : (
              <>
                {/* Colored by sign, not by status (DESIGN.md §5.4): a balance
                    under the buffer but still positive is a warning, and the
                    card's outline and the chip carry that. Painting a positive
                    figure red would make the color contradict the number. */}
                <div className={`money ui-page-title mt-1 text-[40px] leading-tight tabular ${h.amount < 0 ? "text-negative" : "text-text"}`}>
                  <span>{formatCents(h.amount)}</span>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-2.5">
                  <span className="text-[14.5px] font-semibold text-text">{longDate(h.date)}</span>
                  {short && (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-negative bg-negative-subtle px-2.5 py-0.5 text-[11.5px] font-semibold text-negative">
                      <AlertTriangle size={12} strokeWidth={2.5} aria-hidden />
                      {out === 0 ? "today" : `${out} day${out === 1 ? "" : "s"} away`}
                    </span>
                  )}
                </div>
                {h.causes.length > 0 && (
                  <p className="mb-0 mt-2.5 max-w-[48ch] text-[13.5px] leading-relaxed text-text-2">
                    {h.causes.map((c, i) => (
                      <span key={c.label}>
                        {i > 0 && " and "}
                        <strong className="font-semibold text-text">{c.label}</strong>{" "}
                        <span className="money tabular">({formatCents(c.amount)})</span>
                      </span>
                    ))}
                    {" "}
                    {h.causes.length === 1 ? "comes" : "come"} out first.
                  </p>
                )}
                {!short && f.bandBreach && (
                  <p className="mb-0 mt-2.5 max-w-[48ch] text-[13.5px] leading-relaxed text-text-2">
                    A heavier fortnight than usual could still put you under {formatCents(f.cushion)} around {longDate(f.bandBreach.date)}.
                  </p>
                )}
              </>
            )}
          </div>
          <div className="hidden h-[76px] w-px bg-border lg:block" />
          {/* The first short day is often also the lowest. Repeating it as a
              stat says nothing, so that slot falls back to the buffer. */}
          {short && f.lowest.date !== h.date ? (
            <Stat label="Lowest point" value={formatCents(f.lowest.amount)} note={longDate(f.lowest.date)} tone={f.lowest.amount < 0 ? "negative" : undefined} />
          ) : (
            <Stat label="Buffer" value={formatCents(f.cushion)} note="from Safe to spend" />
          )}
          <Stat label="Money in" value={formatCents(f.moneyIn)} note={`${f.assumptions.paycheques} paycheque${f.assumptions.paycheques === 1 ? "" : "s"}`} />
          <Stat
            label="Money out"
            value={formatCents(f.moneyOut)}
            note={f.everydaySpend > 0 ? `incl. ${formatCents(f.everydaySpend)} everyday` : `${f.assumptions.bills} bill${f.assumptions.bills === 1 ? "" : "s"} and cards`}
          />
        </div>
      </Card>

      <Card className="flex flex-col gap-3 p-5 [--bleed:20px] lg:p-6 lg:[--bleed:24px]">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="ui-card-title m-0 text-xl font-semibold text-text">Projected balance</h2>
          <div className="flex items-center gap-3.5 text-[11.5px] text-text-2">
            <span className="inline-flex items-center gap-1.5">
              <svg width="18" height="8" aria-hidden>
                <line x1="0" y1="4" x2="18" y2="4" stroke="var(--series-1)" strokeWidth="2.5" />
              </svg>
              Balance
            </span>
            {f.assumptions.source !== "none" && (
              <span className="inline-flex items-center gap-1.5">
                <svg width="18" height="10" aria-hidden>
                  <rect width="18" height="10" rx="2" fill="var(--series-1)" opacity="0.2" />
                </svg>
                Likely range
              </span>
            )}
          </div>
        </div>
        <div className="ui-bleed h-[260px]">
          <ForecastChart points={points} cushion={f.cushion} shortfallDate={short ? h.date : null} />
        </div>
      </Card>

      {/* Side by side, the two cards share one height: Assumptions sets it
          (with a floor), and the ledger scrolls inside rather than running
          the page on for screens past the card beside it. The ledger's
          content sits in an absolute layer on lg so it adds no height. */}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Card className="lg:relative lg:min-h-[560px]">
          <div className="flex flex-col overflow-hidden rounded-[inherit] lg:absolute lg:inset-0">
            <CardHeader title="What's coming" meta={`${f.events.length} in ${f.range} days`} />
            <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-4">
              <ForecastLedger events={f.events} days={f.days} cushion={f.cushion} />
            </div>
          </div>
        </Card>
        <Card>
          <CardHeader title="Assumptions" />
          <div className="px-5 pb-4">
            <ForecastAssumptions assumptions={f.assumptions} cushion={f.cushion} />
          </div>
        </Card>
      </div>
    </div>
  );
}

function Stat({ label, value, note, tone }: { label: string; value: string; note: string; tone?: "negative" }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-text-2">{label}</span>
      <span className={`money ui-card-title text-[19px] font-semibold tabular ${tone === "negative" ? "text-negative" : "text-text"}`}>
        <span>{value}</span>
      </span>
      <span className="text-[12px] text-text-3">{note}</span>
    </div>
  );
}
