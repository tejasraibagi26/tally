import Link from "next/link";
import { requireUserId } from "@/lib/session";
import { asRange, forecastFor } from "@/lib/forecast";
import { FORECAST_RANGES } from "@tally/core/forecast";
import { formatCents } from "@tally/core/money";
import { dayLabel, dollars, forecastHeadline, listNames, shortDate } from "@/lib/newData";
import { NewSubNav } from "@/components/new/NewNav";
import { AffordPanel } from "@/components/new/AffordPanel";

const KIND_LABEL = { income: "Pay", bill: "Bill", card: "Card payment", loan: "Loan payment" } as const;

export default async function NewForecastPage({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  const userId = await requireUserId();
  const { days } = await searchParams;
  const forecast = await forecastFor(userId, days ? asRange(days) : undefined);
  const range = forecast.range;
  const a = forecast.assumptions;
  const balanceOn = new Map(forecast.days.map((d) => [d.date, d.balance]));

  // The ledger: every event, grouped by week, with where cash stands after each day.
  const weeks: { label: string; rows: typeof forecast.events }[] = [];
  for (const e of forecast.events) {
    const start = new Date(`${e.date}T00:00:00Z`);
    start.setUTCDate(start.getUTCDate() - start.getUTCDay());
    const label = `Week of ${shortDate(start.toISOString().slice(0, 10))}`;
    if (weeks.at(-1)?.label !== label) weeks.push({ label, rows: [] });
    weeks.at(-1)!.rows.push(e);
  }

  const caveats = [
    a.stale.length > 0 && `${listNames(a.stale.map((s) => s.name))} ${a.stale.length === 1 ? "hasn't" : "haven't"} synced in over a day, so the starting balance may be off.`,
    a.cardsExcluded.length > 0 && `${listNames(a.cardsExcluded)} ${a.cardsExcluded.length === 1 ? "is" : "are"} left out: no statement or due date yet.`,
    a.lumpy.length > 0 && `${listNames(a.lumpy)} ${a.lumpy.length === 1 ? "is" : "are"} counted in full on the day ${a.lumpy.length === 1 ? "it's" : "they're"} due.`,
  ].filter(Boolean) as string[];

  return (
    <main className="tn-main">
      <NewSubNav section="plans" />

      <div className="tn-section-head">
        <span className="tn-muted">Where your cash is heading</span>
        <div role="group" aria-label="How far ahead" style={{ display: "flex", gap: 2, padding: 3, borderRadius: 999, background: "var(--tn-surface)" }}>
          {FORECAST_RANGES.map((r) => (
            <Link
              key={r}
              href={`/new/forecast?days=${r}`}
              aria-current={r === range ? "page" : undefined}
              style={{
                display: "inline-flex",
                alignItems: "center",
                minHeight: 36,
                padding: "0 14px",
                borderRadius: 999,
                background: r === range ? "var(--tn-ink)" : "none",
                color: r === range ? "var(--tn-bg)" : "var(--tn-muted)",
                textDecoration: "none",
                fontSize: 14,
                fontWeight: r === range ? 600 : 400,
              }}
            >
              {r} days
            </Link>
          ))}
        </div>
      </div>

      <AffordPanel
        days={forecast.days.map((d) => ({ date: d.date, balance: d.balance }))}
        events={forecast.events.filter((e) => e.affectsCash).map((e) => ({ date: e.date, amount: e.amount, label: e.label }))}
        cushion={forecast.cushion}
        headline={forecastHeadline(forecast, range)}
        title={`The next ${range} days`}
      />

      <div className="tn-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
        <div className="tn-card">
          <span className="tn-muted" style={{ fontSize: 14 }}>
            Coming in
          </span>
          <div className="tn-disp tn-lime money" style={{ fontSize: 32, fontWeight: 700 }}>
            {dollars(forecast.moneyIn)}
          </div>
          <span style={{ fontSize: 13, color: "var(--tn-ink-3)" }}>
            {a.paycheques} paycheque{a.paycheques === 1 ? "" : "s"}
          </span>
        </div>
        <div className="tn-card">
          <span className="tn-muted" style={{ fontSize: 14 }}>
            Going out
          </span>
          <div className="tn-disp money" style={{ fontSize: 32, fontWeight: 700 }}>
            {dollars(forecast.moneyOut)}
          </div>
          <span style={{ fontSize: 13, color: "var(--tn-ink-3)" }}>
            {a.bills} bill{a.bills === 1 ? "" : "s"} and card payments, plus <span className="money">{dollars(forecast.everydaySpend)}</span> of everyday spending
          </span>
        </div>
        <div className="tn-card">
          <span className="tn-muted" style={{ fontSize: 14 }}>
            Everyday spending
          </span>
          <div className="tn-disp money" style={{ fontSize: 32, fontWeight: 700 }}>
            {a.source === "none" ? "—" : `${dollars(a.dailySpendCents)}/day`}
          </div>
          <span style={{ fontSize: 13, color: "var(--tn-ink-3)" }}>
            {a.source === "override"
              ? "The amount you set in Settings."
              : a.source === "none"
                ? "Needs about a month of history to estimate."
                : `Your typical day for each weekday, from the last ${a.historyDays} days.`}
          </span>
        </div>
      </div>

      {caveats.length > 0 && (
        <div className="tn-banner" style={{ background: "var(--tn-amber-wash)", alignItems: "flex-start" }}>
          <i className="tn-dot" style={{ background: "var(--tn-amber)", marginTop: 8 }} />
          <div style={{ flex: "1 1 320px", display: "flex", flexDirection: "column", gap: 4, color: "#f2e3c2", fontSize: 14 }}>
            {caveats.map((c) => (
              <span key={c}>{c}</span>
            ))}
          </div>
        </div>
      )}

      <section className="tn-section" style={{ gap: 4 }}>
        <h2 className="tn-h2">Everything coming up</h2>
        {weeks.length === 0 && <p className="tn-muted">No bills or paydays in this window yet.</p>}
        {weeks.map((w) => (
          <div key={w.label}>
            <div className="tn-muted" style={{ padding: "20px 4px 6px", fontSize: 14, fontWeight: 600 }}>
              {w.label}
            </div>
            {w.rows.map((e, i) => (
              <div
                key={`${e.date}-${e.sourceId}-${i}`}
                style={{ display: "grid", gridTemplateColumns: "110px minmax(0, 1fr) auto auto", gap: "4px 18px", alignItems: "center", padding: "12px 4px", borderTop: "1px solid var(--tn-line)" }}
              >
                <span className="tn-muted" style={{ fontSize: 14 }}>
                  {dayLabel(e.date)}
                </span>
                <span style={{ minWidth: 0 }}>
                  <span className="tn-row-title" style={{ display: "block" }}>
                    {e.label}
                  </span>
                  <span className="tn-row-sub" style={{ display: "block" }}>
                    {KIND_LABEL[e.kind]}
                    {e.modelled ? " · estimated" : ""}
                    {!e.affectsCash ? " · on a card, paid with the card bill" : ""}
                  </span>
                </span>
                <span className="tn-amt money" style={{ color: e.amount > 0 ? "var(--tn-lime)" : e.affectsCash ? "var(--tn-ink)" : "var(--tn-faint)" }}>
                  {e.amount > 0 ? "+" : "−"}
                  {formatCents(Math.abs(e.amount))}
                </span>
                <span className="tn-faint money" style={{ fontSize: 13, minWidth: 90, textAlign: "right" }}>
                  {balanceOn.has(e.date) ? `→ ${dollars(balanceOn.get(e.date)!)}` : ""}
                </span>
              </div>
            ))}
          </div>
        ))}
      </section>
    </main>
  );
}
