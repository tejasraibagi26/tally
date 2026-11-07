import Link from "next/link";
import { and, eq, gte, lt, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireUserId } from "@/lib/session";
import { getUserTimezone } from "@/lib/userTimezone";
import { todayInZone } from "@tally/core/zonedDate";
import { monthLastDay, monthRange, shiftMonth } from "@tally/core/budgetMath";
import { daysBefore } from "@tally/core/overviewView";
import { budgetTally, linePoints, netWorthChange, yFor } from "@tally/core/nowView";
import { netWorthTrend } from "@/lib/networth";
import { forecastFor } from "@/lib/forecast";
import { safeToSpendFor } from "@/lib/safeToSpend";
import { getBudgetsForMonth } from "@/lib/budgets";
import { dailySpend, monthTotals } from "@/lib/analytics";
import { goalSummary } from "@/lib/goals";
import { composition, dollars, listNames, loadAccounts, shortDate, signedDollars } from "@/lib/newData";
import { AffordPanel, type Headline } from "@/components/new/AffordPanel";

const NW_W = 600;
const NW_H = 170;

export default async function NowPage() {
  const userId = await requireUserId();
  const today = todayInZone(await getUserTimezone(userId));
  const month = `${today.slice(0, 7)}-01`;
  const priorMonth = shiftMonth(month, -1);
  const dayOfMonth = Number(today.slice(8, 10));
  const daysInMonth = Number(monthLastDay(month).slice(8, 10));

  const { accounts, items } = await loadAccounts(userId);
  if (accounts.length === 0) {
    return (
      <main className="tn-main">
        <div className="tn-card tn-empty">
          <h1 className="tn-disp" style={{ margin: "0 0 8px", fontSize: 32, color: "var(--tn-ink)" }}>
            Nothing connected yet
          </h1>
          <p style={{ margin: "0 0 18px" }}>Connect a bank, card or brokerage and Tally will show where you stand and what&apos;s ahead.</p>
          <Link href="/accounts" className="tn-btn tn-btn-solid">
            Connect an account
          </Link>
        </div>
      </main>
    );
  }

  const [points, forecast, safe, budgets, thisMonth, thisDaily, priorDaily, goal, [review]] = await Promise.all([
    netWorthTrend(userId, 365),
    forecastFor(userId, 30),
    safeToSpendFor(userId),
    getBudgetsForMonth(userId, month),
    monthTotals(userId, month),
    dailySpend(userId, month),
    dailySpend(userId, priorMonth),
    goalSummary(userId),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.transactions)
      .where(
        and(
          eq(schema.transactions.userId, userId),
          eq(schema.transactions.reviewed, false),
          eq(schema.transactions.isTransfer, false),
          gte(schema.transactions.postedDate, month),
          lt(schema.transactions.postedDate, monthRange(month).end),
        ),
      ),
  ]);

  // ── net worth ──
  const comp = composition(accounts);
  const netWorth = points.at(-1)?.net ?? comp.owned - comp.owed;
  const change = netWorthChange(points, netWorth, today);
  const nets = points.map((p) => p.net);
  const target = goal?.goal.targetCents ?? null;
  const showGoal = target != null && nets.length > 1 && target <= Math.max(...nets) * 1.6;
  const nwRange = nets.length > 1 ? { min: Math.min(...nets), max: Math.max(...nets, showGoal ? target! : -Infinity) } : null;

  // ── this month ──
  const usualByNow = Object.entries(priorDaily)
    .filter(([d]) => Number(d.slice(8, 10)) <= dayOfMonth)
    .reduce((s, [, v]) => s + v, 0);
  const ctx = { phase: "current" as const, daysElapsed: dayOfMonth, daysInMonth };
  const tally = budgetTally(budgets.map((b) => ({ ...b, name: b.categoryName })), ctx);

  // ── the headline, from the forecast ──
  const headline: Headline = !forecast.headline
    ? { tone: "ink", title: "Here's where you stand.", sub: "Tally hasn't spotted a paycheque yet, so it can't look ahead. Add one in Forecast and this page will tell you what's coming." }
    : forecast.headline.kind === "shortfall"
      ? {
          tone: "coral",
          title: `Heads up: ${shortDate(forecast.headline.date)} gets tight.`,
          sub: `Your cash would dip under ${forecast.cushion > 0 ? `your ${dollars(forecast.cushion)} buffer` : "$0"}${forecast.headline.causes.length ? `, mostly from ${listNames(forecast.headline.causes.slice(0, 2).map((c) => c.label))}` : ""}.`,
        }
      : {
          tone: "lime",
          title: "You're in good shape for the next 30 days.",
          sub: `Every bill Tally knows about is covered. Your lowest point is ${dollars(forecast.lowest.amount)}, on ${shortDate(forecast.lowest.date)}.`,
        };

  // ── plain words ──
  const last7 = Array.from({ length: 7 }, (_, i) => daysBefore(today, i)).reduce((s, d) => s + (thisDaily[d] ?? priorDaily[d] ?? 0), 0);
  const usualWeek = forecast.assumptions.source !== "none" ? forecast.assumptions.dailySpendCents * 7 : 0;
  const blocked = items.filter((i) => i.state.needsAttention);
  const notes: { tone: string; body: React.ReactNode }[] = [];
  if (usualWeek > 0) {
    const r = last7 / usualWeek;
    notes.push({
      tone: r > 1.15 ? "var(--tn-amber)" : "var(--tn-lime)",
      body: (
        <>
          You spent <strong className="money">{dollars(last7)}</strong> in the last 7 days{" "}
          {r > 1.15 ? "— more than a usual week." : r < 0.85 ? "— a lighter week than usual." : "— about a normal week for you."}
        </>
      ),
    });
  }
  for (const name of tally.over.slice(0, 2)) {
    const b = budgets.find((x) => x.categoryName === name)!;
    notes.push({
      tone: "var(--tn-coral)",
      body: (
        <>
          <strong>{name}</strong> is over: <span className="money">{dollars(b.spend)}</span> of <span className="money">{dollars(b.amount + b.rolloverFromPrior)}</span> for the month.
        </>
      ),
    });
  }
  if (tally.close.length) {
    notes.push({
      tone: "var(--tn-amber)",
      body: (
        <>
          <strong>{listNames(tally.close.slice(0, 3))}</strong> {tally.close.length === 1 ? "is" : "are"} getting close. <Link href="/new/plans">See budgets</Link>
        </>
      ),
    });
  }
  if ((review?.count ?? 0) > 0) {
    notes.push({
      tone: "var(--tn-amber)",
      body: (
        <>
          <strong>{review!.count}</strong> transaction{review!.count === 1 ? "" : "s"} need a quick look. <Link href="/new/activity?review=1">Review</Link>
        </>
      ),
    });
  }
  for (const i of blocked) {
    notes.push({
      tone: "var(--tn-coral)",
      body: (
        <>
          <strong>{i.institution}</strong> wants you to sign in again. <Link href="/new/accounts">Fix it</Link> — until then its balances are out of date.
        </>
      ),
    });
  }
  if (goal?.projection.status === "off_track" && goal.projection.neededPerMonth && goal.projection.pace != null) {
    notes.push({
      tone: "var(--tn-amber)",
      body: (
        <>
          Your year-end goal is a little behind: you need about <strong className="money">{dollars(goal.projection.neededPerMonth)}</strong> a month and you&apos;re adding <span className="money">{dollars(goal.projection.pace)}</span>.
        </>
      ),
    });
  } else if (goal?.projection.status === "on_track") {
    notes.push({ tone: "var(--tn-lime)", body: <>You&apos;re on track for your year-end goal of <strong className="money">{dollars(goal.goal.targetCents)}</strong>.</> });
  }

  const tiles = [
    { label: "Ready to spend", amount: comp.cash, caption: accounts.filter((a) => a.group === "cash").map((a) => a.name).slice(0, 2).join(" · ") || "No everyday accounts" },
    { label: "Set aside", amount: comp.savings + comp.other, caption: accounts.filter((a) => a.group === "savings").map((a) => a.name).slice(0, 2).join(" · ") || "No savings accounts" },
    { label: "Invested", amount: comp.invested, caption: accounts.filter((a) => a.group === "invested").map((a) => a.name).slice(0, 2).join(" · ") || "No investments connected" },
    {
      label: "You owe",
      amount: comp.owed,
      caption: [
        accounts.filter((a) => a.group === "card").length && `${accounts.filter((a) => a.group === "card").length} card${accounts.filter((a) => a.group === "card").length === 1 ? "" : "s"}`,
        accounts.filter((a) => a.group === "loan").length && `${accounts.filter((a) => a.group === "loan").length} loan${accounts.filter((a) => a.group === "loan").length === 1 ? "" : "s"}`,
      ]
        .filter(Boolean)
        .join(" · ") || "Nothing owed",
    },
  ];

  const spendPct = thisMonth.spend > 0 && usualByNow > 0 ? Math.min(100, (thisMonth.spend / Math.max(thisMonth.spend, usualByNow * 1.4)) * 100) : 0;
  const usualPct = usualByNow > 0 ? Math.min(100, (usualByNow / Math.max(thisMonth.spend, usualByNow * 1.4)) * 100) : null;

  return (
    <main className="tn-main">
      {/* Net worth first: where you stand, in one number. */}
      <section aria-labelledby="tn-nw" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "28px 48px", alignItems: "end", paddingBottom: 32, borderBottom: "1px solid var(--tn-line)" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <span id="tn-nw" className="tn-muted">
            Your net worth · {new Date(`${today}T00:00:00Z`).toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric", timeZone: "UTC" })}
          </span>
          <span className="tn-disp money" style={{ fontSize: "clamp(56px, 8vw, 100px)", fontWeight: 700, letterSpacing: "-0.05em", lineHeight: 0.95 }}>
            {dollars(netWorth)}
          </span>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 18px", fontSize: 16, fontWeight: 500, marginTop: 6 }}>
            {change.month && (
              <span className={change.month.amount >= 0 ? "tn-lime" : "tn-coral"}>
                <span className="money">{signedDollars(change.month.amount)}</span> since {shortDate(change.month.since)}
              </span>
            )}
            {change.year && (
              <span className={change.year.amount >= 0 ? "tn-lime" : "tn-coral"}>
                <span className="money">{signedDollars(change.year.amount)}</span> over the past year
              </span>
            )}
          </div>
          <span className="tn-muted" style={{ fontSize: 14 }}>
            Everything you own (<span className="money">{dollars(comp.owned)}</span>) minus what you owe (<span className="money">{dollars(comp.owed)}</span>)
          </span>
        </div>
        {nwRange && (
          <figure style={{ margin: 0, display: "flex", flexDirection: "column", gap: 8 }}>
            {showGoal && goal && (
              <span className="tn-amber" style={{ fontSize: 13 }}>
                Year-end goal <span className="money">{dollars(goal.goal.targetCents)}</span>
                {goal.projection.gap > 0 && (
                  <>
                    {" "}
                    · <span className="money">{dollars(goal.projection.gap)}</span> to go
                  </>
                )}
              </span>
            )}
            <svg viewBox={`0 0 ${NW_W} ${NW_H}`} preserveAspectRatio="none" style={{ display: "block", width: "100%", height: NW_H }} role="img" aria-label={`Net worth over the past year, from ${dollars(nets[0]!)} to ${dollars(netWorth)}`}>
              {showGoal && <line x1="0" y1={yFor(target!, NW_H, nwRange)} x2={NW_W} y2={yFor(target!, NW_H, nwRange)} stroke="#f2b84b" strokeWidth="1.5" strokeDasharray="6 5" vectorEffect="non-scaling-stroke" />}
              <polyline points={`0,${NW_H} ${linePoints(nets, NW_W, NW_H, 8, nwRange)} ${NW_W},${NW_H}`} fill="#c9f26b" fillOpacity="0.08" stroke="none" />
              <polyline points={linePoints(nets, NW_W, NW_H, 8, nwRange)} fill="none" stroke="#c9f26b" strokeWidth="3" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
            </svg>
            <div className="tn-faint" style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
              <span>{shortDate(points[0]!.asOfDate)}</span>
              <span>Today</span>
            </div>
          </figure>
        )}
      </section>

      <AffordPanel
        days={forecast.days.map((d) => ({ date: d.date, balance: d.balance }))}
        events={forecast.events.filter((e) => e.affectsCash).map((e) => ({ date: e.date, amount: e.amount, label: e.label }))}
        cushion={forecast.cushion}
        headline={headline}
      >
        <section className="tn-section" aria-labelledby="tn-made">
          <div className="tn-section-head">
            <h2 id="tn-made" className="tn-h2">
              What makes up your net worth
            </h2>
            <Link href="/new/accounts" style={{ fontSize: 14 }}>
              All {accounts.length} accounts →
            </Link>
          </div>
          <div className="tn-grid">
            {tiles.map((t) => (
              <Link key={t.label} href="/new/accounts" className="tn-card" style={{ display: "flex", flexDirection: "column", gap: 2, color: "var(--tn-ink)", textDecoration: "none" }}>
                <span className="tn-muted" style={{ fontSize: 14 }}>
                  {t.label}
                </span>
                <span className="tn-disp money" style={{ fontSize: 36, fontWeight: 700, lineHeight: 1.15 }}>
                  {dollars(t.amount)}
                </span>
                <span style={{ fontSize: 13, color: "var(--tn-ink-3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.caption}</span>
              </Link>
            ))}
          </div>

          <div className="tn-grid-2">
            <div className="tn-card" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <span className="tn-muted" style={{ fontSize: 14 }}>
                {new Date(`${month}T00:00:00Z`).toLocaleDateString("en-US", { month: "long", timeZone: "UTC" })} so far · day {dayOfMonth} of {daysInMonth}
              </span>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 28px" }}>
                <span>
                  <span className="tn-disp money" style={{ fontSize: 26, fontWeight: 700 }}>
                    {dollars(thisMonth.spend)}
                  </span>{" "}
                  <span className="tn-muted">spent</span>
                </span>
                <span>
                  <span className="tn-disp tn-lime money" style={{ fontSize: 26, fontWeight: 700 }}>
                    {dollars(thisMonth.income)}
                  </span>{" "}
                  <span className="tn-muted">came in</span>
                </span>
              </div>
              {usualPct != null && (
                <>
                  <div className="tn-bar" aria-hidden="true">
                    <b style={{ width: `${spendPct}%`, background: thisMonth.spend > usualByNow * 1.1 ? "var(--tn-amber)" : "var(--tn-lime)" }} />
                    <i style={{ left: `${usualPct}%` }} />
                  </div>
                  <span style={{ fontSize: 13, color: "var(--tn-ink-3)" }}>
                    {thisMonth.spend > usualByNow * 1.1 ? "More than" : thisMonth.spend < usualByNow * 0.9 ? "Less than" : "About what"} you&apos;d spent by this day last month (the white mark,{" "}
                    <span className="money">{dollars(usualByNow)}</span>).
                  </span>
                </>
              )}
            </div>
            <Link href="/new/plans" className="tn-card" style={{ display: "flex", flexDirection: "column", gap: 10, color: "var(--tn-ink)", textDecoration: "none" }}>
              <span className="tn-muted" style={{ fontSize: 14 }}>
                Budgets
              </span>
              {tally.total === 0 ? (
                <span style={{ color: "var(--tn-ink-3)" }}>No budgets this month yet. Set some up and they&apos;ll show here.</span>
              ) : (
                <>
                  <span>
                    <span className="tn-disp" style={{ fontSize: 26, fontWeight: 700 }}>
                      {tally.fine} of {tally.total}
                    </span>{" "}
                    <span className="tn-muted">on track</span>
                  </span>
                  <div style={{ display: "flex", gap: 4 }} aria-hidden="true">
                    {[...Array(tally.fine).fill("var(--tn-lime)"), ...Array(tally.close.length).fill("var(--tn-amber)"), ...Array(tally.over.length).fill("var(--tn-coral)")].map((c, i) => (
                      <i key={i} style={{ flex: 1, height: 10, borderRadius: 5, background: c }} />
                    ))}
                  </div>
                  <span style={{ fontSize: 13, color: "var(--tn-ink-3)" }}>
                    {tally.over.length ? `${listNames(tally.over)} ${tally.over.length === 1 ? "is" : "are"} over. ` : ""}
                    {tally.close.length ? `${listNames(tally.close)} ${tally.close.length === 1 ? "is" : "are"} close.` : ""}
                    {!tally.over.length && !tally.close.length ? "Everything's within its budget." : ""}
                  </span>
                </>
              )}
            </Link>
          </div>
        </section>
      </AffordPanel>

      <div className="tn-grid-2" style={{ gap: 24 }}>
        <section className="tn-card" style={{ display: "flex", flexDirection: "column", gap: 4, padding: "24px 26px" }}>
          <span className="tn-muted" style={{ fontSize: 14 }}>
            Spend freely today
          </span>
          {safe.perDay != null ? (
            <>
              <span className="tn-disp money" style={{ fontSize: 56, fontWeight: 700, lineHeight: 1.05 }}>
                {dollars(safe.perDay)}
              </span>
              <span style={{ fontSize: 15, color: "var(--tn-ink-3)" }}>
                <span className="money">{dollars(safe.amount)}</span> to spend until {shortDate(safe.window.end)}, after bills{safe.cushion > 0 ? " and your buffer" : ""}. Unspent, it carries into tomorrow.
              </span>
            </>
          ) : safe.cash.length > 0 ? (
            <>
              <span className="tn-disp tn-amber" style={{ fontSize: 40, fontWeight: 700, lineHeight: 1.1 }}>
                Nothing spare
              </span>
              <span style={{ fontSize: 15, color: "var(--tn-ink-3)" }}>Bills come first until {shortDate(safe.window.end)}. Only spend what you must.</span>
            </>
          ) : (
            <span style={{ fontSize: 15, color: "var(--tn-ink-3)" }}>Connect an everyday account to see this.</span>
          )}
        </section>

        <section className="tn-card-line" style={{ display: "flex", flexDirection: "column", padding: "18px 26px 8px" }}>
          <h2 className="tn-h2" style={{ margin: "6px 0 4px", fontSize: 20 }}>
            Lately, in plain words
          </h2>
          {notes.length === 0 ? (
            <p className="tn-muted" style={{ margin: "8px 0 16px" }}>
              Nothing to flag. Enjoy your day.
            </p>
          ) : (
            notes.map((n, i) => (
              <div key={i} className="tn-note">
                <i className="tn-dot" style={{ background: n.tone }} />
                <p>{n.body}</p>
              </div>
            ))
          )}
        </section>
      </div>
    </main>
  );
}
