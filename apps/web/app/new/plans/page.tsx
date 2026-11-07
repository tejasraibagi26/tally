import { requireUserId } from "@/lib/session";
import { getUserTimezone } from "@/lib/userTimezone";
import { getBudgetsForMonth } from "@/lib/budgets";
import { goalSummary } from "@/lib/goals";
import { listUserCategories } from "@/lib/userCategories";
import { todayInZone } from "@tally/core/zonedDate";
import { monthLastDay } from "@tally/core/budgetMath";
import { budgetRowState, monthSummary } from "@tally/core/budgetView";
import { defaultDeadline } from "@tally/core/goalMath";
import { budgetMood, budgetTally, type BudgetMood } from "@tally/core/nowView";
import { dollars, listNames, shortDate } from "@/lib/newData";
import { NewSubNav } from "@/components/new/NewNav";
import { BudgetEditor, type BudgetRowData } from "@/components/new/BudgetEditor";
import { GoalEditor } from "@/components/new/GoalEditor";

const MOOD: Record<BudgetMood, { bar: string; text: string }> = {
  over: { bar: "var(--tn-coral)", text: "#ff9c8c" },
  close: { bar: "var(--tn-amber)", text: "var(--tn-amber)" },
  fine: { bar: "var(--tn-lime)", text: "var(--tn-muted)" },
  fixed: { bar: "#5a5a50", text: "var(--tn-muted)" },
};
const ORDER: BudgetMood[] = ["over", "close", "fine", "fixed"];

export default async function NewPlansPage() {
  const userId = await requireUserId();
  const today = todayInZone(await getUserTimezone(userId));
  const month = `${today.slice(0, 7)}-01`;
  const daysElapsed = Number(today.slice(8, 10));
  const daysInMonth = Number(monthLastDay(month).slice(8, 10));
  const ctx = { phase: "current" as const, daysElapsed, daysInMonth };

  const [goal, budgets, categories] = await Promise.all([goalSummary(userId), getBudgetsForMonth(userId, month), listUserCategories(userId)]);

  const everyday = budgets.filter((b) => !b.isFixedAmount);
  const summary = monthSummary(everyday, ctx);
  const tally = budgetTally(budgets.map((b) => ({ ...b, name: b.categoryName })), ctx);
  const rows: BudgetRowData[] = budgets
    .map((b) => {
      const mood = budgetMood(b, ctx);
      const row = budgetRowState(b, ctx, dollars);
      return {
        mood,
        data: {
          categoryId: b.categoryId,
          name: b.categoryName,
          status: mood === "over" ? `Over by ${row.label.replace(/ over$/, "")}` : mood === "close" ? (row.note ?? row.label) : row.label,
          statusColor: MOOD[mood].text,
          barColor: MOOD[mood].bar,
          pct: Math.round(Math.min(1, row.available > 0 ? b.spend / row.available : 1) * 100),
          pacePct: row.pacePct != null ? Math.round(row.pacePct * 100) : null,
          spend: b.spend,
          available: row.available,
          amount: b.amount,
          over: mood === "over",
          rolloverEnabled: b.rolloverEnabled,
          isFixedAmount: b.isFixedAmount,
        },
      };
    })
    .sort((x, y) => ORDER.indexOf(x.mood) - ORDER.indexOf(y.mood) || y.data.spend - x.data.spend)
    .map((r) => r.data);

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
        <h1 className="tn-disp" style={{ margin: 0, fontSize: "clamp(32px, 4vw, 40px)", fontWeight: 700 }}>
          What you&apos;re working toward
        </h1>
        {goal && p && goalLine ? (
          <div className="tn-card" style={{ display: "flex", flexDirection: "column", gap: 12, padding: 24, borderRadius: 24, maxWidth: 560 }}>
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
          </div>
        ) : (
          <div className="tn-card-line" style={{ maxWidth: 560, display: "flex", flexDirection: "column", gap: 6 }}>
            <span className="tn-disp" style={{ fontSize: 22, fontWeight: 700 }}>
              Pick a number for the end of the year
            </span>
            <span style={{ color: "var(--tn-ink-3)" }}>Set a net worth goal and Tally will tell you whether you&apos;re on pace and what would close the gap.</span>
          </div>
        )}
        <GoalEditor current={goal ? { targetCents: goal.goal.targetCents, deadline: goal.goal.deadline } : null} defaultDeadline={defaultDeadline(today)} />
        {goal && <span className="tn-faint" style={{ fontSize: 13 }}>The white mark is where you&apos;d be if you saved evenly from the start.</span>}
      </section>

      <section className="tn-section" style={{ gap: 8 }}>
        <h2 className="tn-disp" style={{ margin: "0 0 6px", fontSize: 32, fontWeight: 700 }}>
          {new Date(`${month}T00:00:00Z`).toLocaleDateString("en-US", { month: "long", timeZone: "UTC" })} budgets
        </h2>
        {budgets.length > 0 && (
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
        )}
        {budgets.length === 0 && <p className="tn-muted" style={{ margin: "0 0 8px" }}>No budgets this month yet. Add one for anything you want to keep an eye on.</p>}
        <BudgetEditor month={month} rows={rows} categories={categories.filter((c) => c.kind === "expense").map((c) => ({ id: c.id, name: c.name }))} />
        <span className="tn-faint" style={{ fontSize: 13, paddingTop: 12 }}>
          The white mark is where an even pace would put you today (day {daysElapsed} of {daysInMonth}). Fixed bills like rent don&apos;t count against the pace.
        </span>
      </section>
    </main>
  );
}
