import Link from "next/link";
import { requireUserId } from "@/lib/session";
import { goalSummary } from "@/lib/goals";
import { netWorthTrend } from "@/lib/networth";
import { todayFor } from "@/lib/userTimezone";
import { defaultDeadline } from "@tally/core/goalMath";
import { formatCents } from "@tally/core/money";
import { Card, CardHeader } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { GoalCard } from "@/components/goals/GoalCard";
import { GoalChart, type GoalChartPoint } from "@/components/goals/GoalChart";
import { GoalForm } from "@/components/goals/GoalForm";

/**
 * The year-end goal (Tally Pop only: reached from Pop's side nav and
 * Overview card; nothing in the classic look links here). The card, the
 * projection chart, where the shortfall could come from, and the form.
 */
export default async function GoalsPage() {
  const userId = await requireUserId();
  const [summary, today] = await Promise.all([goalSummary(userId), todayFor(userId)]);

  if (!summary) {
    return (
      <div className="max-w-[880px] mx-auto px-4 lg:px-8 py-5 lg:py-7 flex flex-col gap-6">
        <PageHeader title="Year-end goal" meta={["Pick a net worth to reach and Tally tracks the pace"]} />
        <Card className="p-6 lg:p-7">
          <GoalForm defaultDeadline={defaultDeadline(today)} />
        </Card>
      </div>
    );
  }

  const { goal, projection: p, cuts } = summary;
  const history = (await netWorthTrend(userId, 400)).filter((pt) => pt.asOfDate >= `${goal.startDate.slice(0, 4)}-01-01`);
  const points: GoalChartPoint[] = history.map((pt) => ({ date: pt.asOfDate, actual: pt.net }));
  if (p.projected != null && goal.deadline > today) {
    const last = points.at(-1);
    if (last) last.projected = last.actual;
    points.push({ date: goal.deadline, projected: Math.round(p.projected) });
  }

  return (
    <div className="max-w-[880px] mx-auto px-4 lg:px-8 py-5 lg:py-7 flex flex-col gap-6">
      <PageHeader
        title="Year-end goal"
        meta={[
          <span key="target"><span className="money money-fit"><span>{formatCents(goal.targetCents)}</span></span> net worth</span>,
          <span key="start">started at <span className="money money-fit"><span>{formatCents(goal.startCents)}</span></span></span>,
        ]}
      />
      <GoalCard summary={summary} showCurrent />

      <Card className="p-5 lg:p-6 [--bleed:20px] lg:[--bleed:24px] flex flex-col gap-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="ui-card-title m-0 text-xl font-semibold text-text">Where the pace lands</h2>
          <span className="text-[13px] text-text-2">Pace = net worth&apos;s average change over the last 3 full months</span>
        </div>
        {points.length > 1 ? (
          <div className="ui-bleed goal-chart">
            <GoalChart points={points} target={goal.targetCents} />
          </div>
        ) : (
          <div className="h-[160px] rounded-control bg-sunken flex items-center justify-center px-8 text-center text-[13.5px] text-text-2">
            The chart fills in as Tally records your net worth each day.
          </div>
        )}
      </Card>

      {cuts.length > 0 && (
        <Card>
          <CardHeader title="Where to find it" meta={`${formatCents(Math.round(p.shortBy ?? 0))} more a month`} metaIsMoney />
          <ul className="m-0 p-0 list-none divide-y divide-border">
            {cuts.map((c) => (
              <li key={c.key}>
                <Link href={`/transactions?category=${c.key}&transfer=0&excluded=0`} className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-surface-2">
                  <span className="flex flex-col">
                    <span className="text-[15px] text-text">{c.label}</span>
                    <span className="text-[13px] text-text-2 tabular">usually {formatCents(c.avgMonthly)} a month</span>
                  </span>
                  <span className="text-[14px] font-semibold text-text tabular">save {formatCents(c.save)}/mo</span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card>
        <CardHeader title="Change the goal" />
        <div className="p-5">
          <GoalForm targetCents={goal.targetCents} deadline={goal.deadline} defaultDeadline={defaultDeadline(today)} />
        </div>
      </Card>
    </div>
  );
}
