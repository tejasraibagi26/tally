import Link from "next/link";
import { requireUserId } from "@/lib/session";
import { getUserTimezone } from "@/lib/userTimezone";
import { getBudgetsForMonth } from "@/lib/budgets";
import { goalSummary } from "@/lib/goals";
import { todayInZone } from "@tally/core/zonedDate";
import { monthLastDay } from "@tally/core/budgetMath";
import { budgetRowState, monthSummary } from "@tally/core/budgetView";
import { budgetMood, budgetTally, type BudgetMood } from "@tally/core/nowView";
import { dollars, listNames, shortDate } from "@/lib/newData";
import { NewSubNav } from "@/components/new/NewNav";

const MOOD: Record<BudgetMood, { bar: string; text: string }> = {
  over: { bar: "var(--tn-coral)", text: "#ff9c8c" },
  close: { bar: "var(--tn-amber)", text: "var(--tn-amber)" },
  fine: { bar: "var(--tn-lime)", text: "var(--tn-muted)" },
  fixed: { bar: "#5a5a50", text: "var(--tn-muted)" },
};

export default async function NewPlansPage() {
  const userId = await requireUserId();
  const today = todayInZone(await getUserTimezone(userId));
  const month = `${today.slice(0, 7)}-01`;
  const daysElapsed = Number(today.slice(8, 10));
  const daysInMonth = Number(monthLastDay(month).slice(8, 10));
  const ctx = { phase: "current" as const, daysElapsed, daysInMonth };

  const [goal, budgets] = await Promise.all([goalSummary(userId), getBudgetsForMonth(userId, month)]);

  const everyday = budgets.filter((b) => !b.isFixedAmount);
  const summary = monthSummary(everyday, ctx);
  const tally = budgetTally(budgets.map((b) => ({ ...b, name: b.categoryName })), ctx);
  const rows = budgets
    .map((b) => {
      const mood = budgetMood(b, ctx);
      const row = budgetRowState(b, ctx, dollars);
      const status = mood === "over" ? `Over by ${row.label.replace(/ over$/, "")}` : mood === "close" ? (row.note ?? row.label) : row.label;
      return { b, mood, row, status };
    })
    // Over first, then close, then the rest; fixed bills last.
    .sort((x, y) => ["over", "close", "fine", "fixed"].indexOf(x.mood) - ["over", "close", "fine", "fixed"].indexOf(y.mood) || y.b.spend - x.b.spend);

  const p = goal?.projection;
  const elapsed = goal ? Math.min(1, Math.max(0, (Date.parse(today) - Date.parse(goal.goal.startDate)) / (Date.parse(goal.goal.deadline) - Date.parse(goal.goal.startDate) || 1))) : 0;
  const goalLine =
    !p || !goal
      ? null
      : p.status === "reached"
        ? { tone: "var(--tn-lime)", head: "Reached", body: "You hit it. Set a bigger one whenever you like." }
        : p.status === "on_track"
          ? { tone: "var(--tn-lime)", head: "On track", body: p.projected != null ? `At your pace you'll be around ${dollars(p.projected)} by ${shortDate(goal.goal.deadline)}.` : "Keep doing what you're doing." }
          : p.status === "off_track"
            ? {
                tone: "var(--tn-amber)",
                head: "A little behind",
                body: `You need about ${dollars(p.neededPerMonth ?? 0)} a month${p.pace != null ? ` and you're adding ${dollars(p.pace)}` : ""}.${goal.cuts[0] ? ` Spending ${dollars(goal.cuts[0].save)} less a month on ${goal.cuts[0].label} would help.` : ""}`,
              }
            : p.status === "ended"
              ? { tone: "var(--tn-muted)", head: "Deadline passed", body: "Set a new one for next year." }
              : { tone: "var(--tn-muted)", head: "Too early to tell", body: "Tally needs a few more weeks of history to judge your pace." };

  return (
    <main className="tn-main" style={{ gap: 40 }}>
      <NewSubNav section="plans" />

      <section className="tn-section" style={{ gap: 18 }}>
        <div className="tn-section-head">
          <h1 className="tn-disp" style={{ margin: 0, fontSize: "clamp(32px, 4vw, 40px)", fontWeight: 700 }}>
            What you&apos;re working toward
          </h1>
          <Link href="/goals" className="tn-btn">
            {goal ? "Change goal" : "Set a goal"}
          </Link>
        </div>
        {goal && p && goalLine ? (
          <Link href="/goals" className="tn-card" style={{ display: "flex", flexDirection: "column", gap: 12, padding: 24, borderRadius: 24, color: "var(--tn-ink)", textDecoration: "none", maxWidth: 560 }}>
            <span className="tn-muted" style={{ fontSize: 14 }}>
              Net worth by {shortDate(goal.goal.deadline)}
            </span>
            <span>
              <span className="tn-disp money" style={{ fontSize: 40, fontWeight: 700 }}>
                {dollars(p.current)}
              </span>{" "}
              <span className="tn-faint">
                of <span className="money">{dollars(p.target)}</span>
              </span>
            </span>
            <div className="tn-bar" style={{ height: 12 }} aria-hidden="true">
              <b style={{ width: `${Math.round(Math.min(1, p.progress) * 100)}%`, background: "var(--tn-lime)" }} />
              {p.status !== "reached" && <i style={{ left: `${Math.round(elapsed * 100)}%` }} />}
            </div>
            <span style={{ fontSize: 14, fontWeight: 500, color: goalLine.tone }}>{goalLine.head}</span>
            <span style={{ fontSize: 14, color: "var(--tn-ink-3)" }}>{goalLine.body}</span>
          </Link>
        ) : (
          <div className="tn-card-line" style={{ maxWidth: 560, display: "flex", flexDirection: "column", gap: 10 }}>
            <span className="tn-disp" style={{ fontSize: 22, fontWeight: 700 }}>
              Pick a number for the end of the year
            </span>
            <span style={{ color: "var(--tn-ink-3)" }}>Set a net worth goal and Tally will tell you, every week, whether you&apos;re on pace and what would close the gap.</span>
            <Link href="/goals" className="tn-btn tn-btn-lime" style={{ alignSelf: "flex-start" }}>
              Set a goal
            </Link>
          </div>
        )}
        {goal && <span className="tn-faint" style={{ fontSize: 13 }}>The white mark is where you&apos;d be if you saved evenly from the start.</span>}
      </section>

      <section className="tn-section" style={{ gap: 8 }}>
        <div className="tn-section-head" style={{ marginBottom: 6 }}>
          <h2 className="tn-disp" style={{ margin: 0, fontSize: 32, fontWeight: 700 }}>
            {new Date(`${month}T00:00:00Z`).toLocaleDateString("en-US", { month: "long", timeZone: "UTC" })} budgets
          </h2>
          <Link href="/budgets" className="tn-btn">
            Edit budgets
          </Link>
        </div>
        {budgets.length === 0 ? (
          <div className="tn-card tn-empty">
            No budgets this month. <Link href="/budgets">Set some up</Link> and they&apos;ll show here.
          </div>
        ) : (
          <>
            <p style={{ margin: "0 0 10px", fontSize: 18, color: "var(--tn-ink-2)", maxWidth: "62ch" }}>
              {tally.over.length || tally.close.length
                ? `${tally.over.length ? `${listNames(tally.over)} ${tally.over.length === 1 ? "is" : "are"} over` : ""}${tally.over.length && tally.close.length ? " and " : ""}${tally.close.length ? `${listNames(tally.close)} ${tally.close.length === 1 ? "is" : "are"} close` : ""}; the rest are fine. `
                : "Everything is within its budget. "}
              {summary.left > 0 ? (
                <>
                  You have <strong className="money" style={{ color: "var(--tn-ink)" }}>{dollars(summary.left)}</strong> left across your everyday budgets
                  {summary.perDay != null && summary.daysLeft ? (
                    <>
                      {" "}
                      for the next {summary.daysLeft} days, about <span className="money">{dollars(summary.perDay)}</span> a day.
                    </>
                  ) : (
                    "."
                  )}
                </>
              ) : (
                "Your everyday budgets are used up for the month."
              )}
            </p>
            {rows.map(({ b, mood, row, status }) => (
              <Link
                key={b.categoryId}
                href={`/transactions?category=${b.categoryId}&from=${month}&to=${monthLastDay(month)}&transfer=0&excluded=0`}
                style={{ display: "grid", gridTemplateColumns: "minmax(140px, 1fr) minmax(160px, 2fr) auto", gap: "8px 28px", alignItems: "center", padding: "16px 4px", borderTop: "1px solid var(--tn-line)", color: "var(--tn-ink)", textDecoration: "none" }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 16, fontWeight: 500 }}>{b.categoryName}</div>
                  <div style={{ fontSize: 13, color: MOOD[mood].text }}>{status}</div>
                </div>
                <div className="tn-bar" aria-hidden="true">
                  <b style={{ width: `${Math.round(Math.min(1, row.available > 0 ? b.spend / row.available : 1) * 100)}%`, background: MOOD[mood].bar }} />
                  {row.pacePct != null && <i style={{ left: `${Math.round(row.pacePct * 100)}%` }} />}
                </div>
                <div className="tn-disp" style={{ fontSize: 20, fontWeight: 700, textAlign: "right", whiteSpace: "nowrap" }}>
                  <span className="money" style={{ color: mood === "over" ? "#ff9c8c" : undefined }}>
                    {dollars(b.spend)}
                  </span>{" "}
                  <span className="tn-faint money" style={{ fontSize: 15 }}>
                    / {dollars(row.available)}
                  </span>
                </div>
              </Link>
            ))}
            <span className="tn-faint" style={{ fontSize: 13, paddingTop: 10, borderTop: "1px solid var(--tn-line)" }}>
              The white mark is where an even pace would put you today (day {daysElapsed} of {daysInMonth}). Fixed bills like rent don&apos;t count against the pace.
            </span>
          </>
        )}
      </section>
    </main>
  );
}
