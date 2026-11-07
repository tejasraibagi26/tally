import Link from "next/link";
import { formatCents } from "@tally/core/money";
import { budgetRunway, type RunwayContext } from "@tally/core/budgetRunway";
import { goalCost, type GoalCost } from "@tally/core/goalCost";
import { computeBurnRateProjection } from "@tally/core/budgetMath";
import { Card, CardHeader } from "@/components/ui/Card";
import type { BudgetLine } from "@/lib/budgets";
import { cn } from "@/lib/cn";

function fmt(c: number) {
  return formatCents(c).replace(/\.00$/, "");
}

function M({ cents }: { cents: number }) {
  return (
    <span className="money money-fit">
      <span>{fmt(Math.round(cents))}</span>
    </span>
  );
}

interface Priced {
  line: BudgetLine;
  available: number;
  over: number;
  cost: GoalCost;
  /** The runway sentence's short form: "runs dry Wed", "over", null when healthy. */
  flag: { label: string; tone: "negative" | "warning" } | null;
}

/** The chip beside a name: what the runway state means in two or three words. */
function flagFor(state: string, runsOutDay: number | null, month: string): Priced["flag"] {
  if (state === "over") return { label: "over", tone: "negative" };
  if (state === "runs_dry" && runsOutDay != null) return { label: `runs dry ${weekday(month, runsOutDay)}`, tone: "negative" };
  if (state === "lands_short" && runsOutDay != null) return { label: `lands ${weekday(month, runsOutDay)}`, tone: "warning" };
  return null;
}

function weekday(month: string, day: number): string {
  const d = new Date(`${month.slice(0, 8)}${String(day).padStart(2, "0")}T00:00:00Z`);
  return d.toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" });
}

/**
 * What's costing you this month: the budgets that are over or will not last,
 * each priced in days off the goal date.
 *
 * Only the rows that cost something are listed. The healthy ones collapse
 * into one line with a total, so a good month is four words and a number
 * rather than eight rows of green.
 */
export function GoalCosts({
  budgets,
  month,
  ctx,
  neededPerMonth,
}: {
  budgets: BudgetLine[];
  month: string;
  ctx: RunwayContext;
  neededPerMonth: number | null;
}) {
  if (budgets.length === 0) return null;

  const priced: Priced[] = budgets.map((line) => {
    const available = line.amount + line.rolloverFromPrior;
    const over = Math.max(0, line.spend - available);
    const projectedSpend =
      !line.isFixedAmount && ctx.daysElapsed != null ? computeBurnRateProjection(line.spend, ctx.daysElapsed, ctx.daysInMonth) : null;
    const projectedOver = projectedSpend != null ? Math.max(0, projectedSpend - available) : null;
    const r = budgetRunway({ available, spend: line.spend, isFixedAmount: line.isFixedAmount }, ctx, fmt);
    return {
      line,
      available,
      over,
      cost: goalCost({ over, projectedOver, neededPerMonth, daysInMonth: ctx.daysInMonth }),
      flag: flagFor(r.state, r.runsOutDay, month),
    };
  });

  const costing = priced
    .filter((p) => p.cost.kind !== "none")
    .sort((a, b) => (b.cost.projectedDays ?? b.cost.days ?? 0) - (a.cost.projectedDays ?? a.cost.days ?? 0))
    .slice(0, 4);
  const healthy = priced.filter((p) => !costing.includes(p));
  const healthyLeft = healthy.reduce((s, p) => s + Math.max(0, p.available - p.line.spend), 0);

  if (costing.length === 0) {
    return (
      <Card>
        <CardHeader title="What's costing you this month" action={<Link href="/budgets" className="text-brand text-[13.5px]">Budgets →</Link>} />
        <div className="p-5 text-[14px] text-text-2 tabular">
          Nothing. All {budgets.length} budgets are inside their pace, with <span className="font-medium text-text"><M cents={healthyLeft} /></span> still to spend.
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader title="What's costing you this month" action={<Link href="/budgets" className="text-brand text-[13.5px]">Budgets →</Link>} />
      <div className="px-5 py-1.5">
        {costing.map((p) => (
          <div key={p.line.categoryId} className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-border py-3 last:border-b-0">
            <span className="flex-1 min-w-[180px]">
              <span className="flex items-center gap-2">
                <span className="text-[14.5px] font-medium text-text">{p.line.categoryName}</span>
                {p.flag && (
                  <span
                    className={cn(
                      "rounded-badge px-1.5 py-px text-[11.5px] font-medium",
                      p.flag.tone === "negative" ? "bg-negative-subtle text-negative" : "bg-warning-subtle text-warning",
                    )}
                  >
                    {p.flag.label}
                  </span>
                )}
              </span>
              <span className="block text-[12.5px] text-text-3 tabular">
                <M cents={p.line.spend} /> of <M cents={p.available} /> spent
                {ctx.daysElapsed != null && ` on day ${ctx.daysElapsed}`}
              </span>
            </span>
            <span className="w-[92px] text-right text-[13.5px] tabular text-negative">
              {p.over > 0 ? <>+<M cents={p.over} /></> : <span className="text-text-3">on pace</span>}
            </span>
            <span className="w-[136px] text-right text-[12.5px] text-text-3">
              {p.cost.label && <span className="block text-[14px] font-medium text-text tabular">{p.cost.label}</span>}
              {p.cost.note}
            </span>
          </div>
        ))}
        {healthy.length > 0 && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border py-3">
            <span className="flex-1 min-w-[180px]">
              <span className="flex items-center gap-2">
                <span className="text-[14.5px] font-medium text-text">The other {healthy.length}</span>
                <span className="rounded-badge bg-positive-subtle px-1.5 py-px text-[11.5px] font-medium text-positive">all on pace</span>
              </span>
              <span className="block text-[12.5px] text-text-3 tabular">
                <M cents={healthyLeft} /> left, every one of them lasting the month
              </span>
            </span>
            <span className="w-[92px] text-right text-[13.5px] text-text-3">on pace</span>
            <span className="w-[136px] text-right text-[12.5px] text-text-3">no cost</span>
          </div>
        )}
      </div>
    </Card>
  );
}
