import Link from "next/link";
import { and, eq, isNull } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireUserId } from "@/lib/session";
import { getUserTimezone } from "@/lib/userTimezone";
import { forecastFor } from "@/lib/forecast";
import { todayInZone } from "@tally/core/zonedDate";
import { monthLastDay, monthRange } from "@tally/core/budgetMath";
import { isActiveExpenseStream, monthlyCost, subscriptionsMonthlyTotal } from "@tally/core/subscriptionMath";
import { formatCents } from "@tally/core/money";
import { dollars, shortDate } from "@/lib/newData";
import { NewSubNav } from "@/components/new/NewNav";

type CalItem = { label: string; amount: number; kind: "in" | "big" | "paid" | "bill" };

const BIG_CENTS = 50_000;
const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default async function NewBillsPage() {
  const userId = await requireUserId();
  const today = todayInZone(await getUserTimezone(userId));
  const month = `${today.slice(0, 7)}-01`;
  const last = monthLastDay(month);
  const { end: monthEnd } = monthRange(month);

  const [forecast, streams] = await Promise.all([
    forecastFor(userId, 60),
    db
      .select({
        id: schema.recurringStreams.id,
        description: schema.recurringStreams.description,
        averageAmount: schema.recurringStreams.averageAmount,
        frequency: schema.recurringStreams.frequency,
        status: schema.recurringStreams.status,
        lastDate: schema.recurringStreams.lastDate,
        predictedNextDate: schema.recurringStreams.predictedNextDate,
        manualNextDueDate: schema.recurringStreams.manualNextDueDate,
        isManual: schema.recurringStreams.isManual,
        amortizeMonthly: schema.recurringStreams.amortizeMonthly,
        amortizeMonths: schema.recurringStreams.amortizeMonths,
      })
      .from(schema.recurringStreams)
      .where(and(eq(schema.recurringStreams.userId, userId), isNull(schema.recurringStreams.dismissedAt))),
  ]);

  const active = streams.filter(isActiveExpenseStream).map((s) => ({ ...s, description: s.description ?? "Recurring charge", next: s.manualNextDueDate ?? s.predictedNextDate, perMonth: monthlyCost(s) }));
  const { monthlyTotal } = subscriptionsMonthlyTotal(streams);
  const found = active.filter((s) => !s.isManual).sort((a, b) => b.perMonth - a.perMonth);
  const added = active.filter((s) => s.isManual).sort((a, b) => b.perMonth - a.perMonth);

  // What's still to come this month, from the forecast (cash-moving events only,
  // so a bill charged to a card isn't counted twice: once itself, once in the card payment).
  const upcoming = forecast.events.filter((e) => e.date >= today && e.date < monthEnd);
  const toPay = upcoming.filter((e) => e.amount < 0 && e.affectsCash);
  const toPayTotal = toPay.reduce((s, e) => s - e.amount, 0);
  const paydays = upcoming.filter((e) => e.kind === "income");
  const monthDays = forecast.days.filter((d) => d.date < monthEnd);
  const lowest = monthDays.reduce<{ date: string; balance: number } | null>((lo, d) => (!lo || d.balance < lo.balance ? d : lo), null);
  const covered = !lowest || lowest.balance >= forecast.cushion;

  // The calendar: what's already been charged this month, then the forecast.
  const byDay = new Map<string, CalItem[]>();
  const add = (date: string, item: CalItem) => byDay.set(date, [...(byDay.get(date) ?? []), item]);
  for (const s of active) {
    if (s.lastDate && s.lastDate >= month && s.lastDate < today) add(s.lastDate, { label: s.description, amount: s.averageAmount, kind: "paid" });
  }
  for (const e of upcoming) {
    add(e.date, { label: e.label, amount: e.amount, kind: e.kind === "income" ? "in" : -e.amount >= BIG_CENTS ? "big" : "bill" });
  }
  const lead = new Date(`${month}T00:00:00Z`).getUTCDay();
  const count = Number(last.slice(8, 10));
  const cells: ({ date: string; day: number } | null)[] = [...Array(lead).fill(null), ...Array.from({ length: count }, (_, i) => ({ date: `${month.slice(0, 8)}${String(i + 1).padStart(2, "0")}`, day: i + 1 }))];
  while (cells.length % 7) cells.push(null);

  const monthName = new Date(`${month}T00:00:00Z`).toLocaleDateString("en-US", { month: "long", timeZone: "UTC" });

  return (
    <main className="tn-main">
      <NewSubNav section="plans" />

      <section className="tn-section-head" style={{ alignItems: "flex-end" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span className="tn-muted">Still to pay in {monthName}</span>
          <span className="tn-disp money" style={{ fontSize: "clamp(48px, 6vw, 64px)", fontWeight: 700, lineHeight: 1 }}>
            {dollars(toPayTotal)}
          </span>
          <span style={{ fontSize: 16, color: covered ? "var(--tn-ink-3)" : "var(--tn-amber)" }}>
            {toPay.length} payment{toPay.length === 1 ? "" : "s"} left.{" "}
            {covered
              ? `All covered by what's in your accounts${paydays.length ? ` plus your pay on ${shortDate(paydays[0]!.date)}` : ""}.`
              : `Cash may run short around ${shortDate(lowest!.date)}.`}{" "}
            {!covered && <Link href="/new">See what&apos;s ahead</Link>}
          </span>
        </div>
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", fontSize: 13 }} className="tn-muted">
          <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <i style={{ width: 10, height: 10, borderRadius: 3, background: "var(--tn-lime)" }} />
            Money in
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <i style={{ width: 10, height: 10, borderRadius: 3, background: "var(--tn-amber)" }} />
            Over {dollars(BIG_CENTS)}
          </span>
        </div>
      </section>

      <section aria-label={`${monthName} calendar`} style={{ overflowX: "auto" }}>
        <div style={{ minWidth: 700, display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", gap: 6 }}>
          {DOW.map((d) => (
            <span key={d} className="tn-faint" style={{ fontSize: 12, padding: "0 8px 4px" }}>
              {d}
            </span>
          ))}
          {cells.map((c, i) =>
            !c ? (
              <div key={i} />
            ) : (
              <div
                key={c.date}
                style={{
                  minHeight: 96,
                  padding: "8px 10px",
                  borderRadius: 14,
                  background: "var(--tn-surface)",
                  display: "flex",
                  flexDirection: "column",
                  gap: 4,
                  opacity: c.date < today ? 0.55 : 1,
                  boxShadow: c.date === today ? "inset 0 0 0 2px var(--tn-ink)" : undefined,
                }}
              >
                <span className="tn-muted" style={{ fontSize: 13 }}>
                  {c.date === today ? `${c.day} · Today` : c.day}
                </span>
                {(byDay.get(c.date) ?? []).slice(0, 3).map((it, j) => (
                  <span
                    key={j}
                    title={`${it.label} ${formatCents(Math.abs(it.amount))}`}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 6,
                      fontSize: 12,
                      lineHeight: 1.3,
                      padding: "3px 7px",
                      borderRadius: 8,
                      background: it.kind === "in" ? "#2a3312" : it.kind === "big" ? "#3a2a14" : "#26261f",
                      color: it.kind === "in" ? "var(--tn-lime)" : it.kind === "big" ? "var(--tn-amber)" : "var(--tn-ink)",
                    }}
                  >
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.label}</span>
                    <span className="money" style={{ flex: "none" }}>
                      {it.amount > 0 ? "+" : ""}
                      {dollars(Math.abs(it.amount))}
                    </span>
                  </span>
                ))}
                {(byDay.get(c.date)?.length ?? 0) > 3 && <span className="tn-faint" style={{ fontSize: 11 }}>+{byDay.get(c.date)!.length - 3} more</span>}
              </div>
            ),
          )}
        </div>
      </section>

      <div className="tn-grid-2" style={{ gap: 40 }}>
        <section>
          <div className="tn-section-head" style={{ marginBottom: 8 }}>
            <h2 className="tn-h2" style={{ fontSize: 26 }}>
              Recurring charges
            </h2>
            <span className="tn-muted" style={{ fontSize: 14 }}>
              <span className="money">{dollars(monthlyTotal)}</span> a month
            </span>
          </div>
          {found.length === 0 ? (
            <p className="tn-muted">Nothing found yet. Tally spots a charge once it repeats three times on a steady schedule.</p>
          ) : (
            <>
              <p className="tn-card" style={{ margin: "0 0 6px", padding: "14px 16px", borderRadius: 14, color: "var(--tn-ink-2)" }}>
                That&apos;s <strong className="money" style={{ color: "var(--tn-ink)" }}>{dollars(monthlyTotal * 12)}</strong> a year.
              </p>
              {found.map((s) => (
                <StreamRow key={s.id} name={s.description} sub={s.next ? `Next ${shortDate(s.next)}${s.status === "at_risk" ? " · may have stopped" : ""}` : "No date yet"} amount={s.perMonth} perMonth />
              ))}
            </>
          )}
        </section>

        <section>
          <div className="tn-section-head" style={{ marginBottom: 8 }}>
            <h2 className="tn-h2" style={{ fontSize: 26 }}>
              Bills you added
            </h2>
            <Link href="/subscriptions" style={{ fontSize: 14 }}>
              Add or edit →
            </Link>
          </div>
          {added.length === 0 ? (
            <p className="tn-muted">Rent, or anything paid in a way Tally can&apos;t see? Add it in the classic view and it&apos;ll show up here and in your forecast.</p>
          ) : (
            added.map((s) => <StreamRow key={s.id} name={s.description} sub={s.next ? `Next ${shortDate(s.next)}` : "No date yet"} amount={Math.abs(s.averageAmount)} />)
          )}
        </section>
      </div>
    </main>
  );
}

function StreamRow({ name, sub, amount, perMonth }: { name: string; sub: string; amount: number; perMonth?: boolean }) {
  return (
    <div className="tn-row" style={{ padding: "14px 4px", borderTop: "1px solid var(--tn-line)", borderRadius: 0 }}>
      <span className="tn-avatar" aria-hidden="true">
        {name.trim().charAt(0).toUpperCase()}
      </span>
      <span style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
        <span className="tn-row-title">{name}</span>
        <span className="tn-row-sub">{sub}</span>
      </span>
      <span className="tn-amt money">
        {formatCents(amount)}
        {perMonth && <span className="tn-faint" style={{ fontSize: 12, fontWeight: 400, fontFamily: "var(--font-inter)" }}> /mo</span>}
      </span>
    </div>
  );
}
