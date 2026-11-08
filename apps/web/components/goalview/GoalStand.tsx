import Link from "next/link";
import { AlertTriangle, CheckCircle2, Clock, Flag } from "lucide-react";
import { formatCents } from "@tally/core/money";
import { NET_WORTH_CURRENCY } from "@tally/core/fx";
import type { GoalStatus } from "@tally/core/goalMath";
import { Card } from "@/components/ui/Card";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";
import { GOAL_STATUS_LABEL, deadlineLabel } from "@/lib/goalCopy";
import type { GoalSummary } from "@/lib/goals";
import { cn } from "@/lib/cn";

/** A net worth figure inside running text, masked by "hide amounts". */
function M({ cents }: { cents: number }) {
  return (
    <span className="money money-fit">
      <span>{formatCents(Math.round(cents))}</span>
    </span>
  );
}

const STATUS_ICON: Record<GoalStatus, typeof CheckCircle2> = {
  on_track: CheckCircle2,
  off_track: AlertTriangle,
  reached: Flag,
  ended: Clock,
  unknown: Clock,
};

/** The verdict's own line: what it takes from here, or where you land. */
function VerdictNumber({ summary: { projection: p } }: { summary: GoalSummary }) {
  if (p.status === "reached") return <>Reached</>;
  if (p.status === "ended") return <><M cents={p.gap} /> <span className="text-[14px] font-medium">short</span></>;
  if (p.status === "off_track" && p.shortBy != null) return <><M cents={p.shortBy} /> <span className="text-[14px] font-medium">a month short</span></>;
  if (p.neededPerMonth != null) return <><M cents={p.neededPerMonth} /> <span className="text-[14px] font-medium">a month from here</span></>;
  return <>Needs a month of history</>;
}

function VerdictLine({ summary: { projection: p } }: { summary: GoalSummary }) {
  if (p.status === "reached") return <>You passed <M cents={p.target} /> with <M cents={p.current - p.target} /> to spare.</>;
  if (p.status === "ended") return <>The deadline passed with the goal <M cents={p.gap} /> away.</>;
  if (p.status === "unknown") return <>Tally needs about a month of history before it can call this.</>;
  if (p.status === "on_track") return <>At the pace of the last three months you land on <M cents={p.projected!} />, past your target.</>;
  return (
    <>
      At the pace of the last three months you land on <M cents={p.projected!} />, <M cents={p.target - p.projected!} /> under.
      Saving <M cents={p.shortBy!} /> more a month closes it.
    </>
  );
}

/**
 * The goal view's hero: net worth first, with the goal that gives it a point.
 *
 * The bar runs from where the goal started to the target, filled to today,
 * with a dot where the current pace projects you to land. A dot short of the
 * right edge is the whole message, so it is drawn before any of the words.
 *
 * Without a goal set it is the plain net worth hero plus one invitation,
 * because the bands below it all read against a target.
 */
export function GoalStand({
  netWorth,
  summary,
  deltaLine,
  className,
  style,
}: {
  netWorth: number;
  summary: GoalSummary | null;
  /** "+$1,818 this month", already formatted by the caller. */
  deltaLine?: string | null;
  className?: string;
  style?: React.CSSProperties;
}) {
  const p = summary?.projection ?? null;
  const goal = summary?.goal ?? null;
  const projectedPct =
    p?.projected != null && goal != null && goal.targetCents > goal.startCents
      ? Math.min(1, Math.max(0, (p.projected - goal.startCents) / (goal.targetCents - goal.startCents)))
      : null;
  const Icon = p ? STATUS_ICON[p.status] : null;

  return (
    <Card className={cn("ui-hero p-5 lg:p-7 overflow-hidden", className)} style={style}>
      <div className="flex flex-col lg:flex-row lg:items-stretch gap-6 lg:gap-9">
        <div className="flex-1 min-w-0 flex flex-col">
          <span className="text-xs font-semibold uppercase tracking-[0.07em] text-text-2">Net worth ({NET_WORTH_CURRENCY})</span>
          <AnimatedNumber cents={netWorth} className="mt-1.5 font-display text-[40px] lg:text-[56px] leading-none text-text tabular money" />
          {deltaLine && <span className="mt-2 text-[13px] text-text-2 tabular">{deltaLine}</span>}

          {goal && p ? (
            <div className="mt-6">
              <div
                className="relative h-1.5 rounded-full bg-[color-mix(in_srgb,currentColor_22%,transparent)]"
                role="img"
                aria-label={`${Math.round(p.progress * 100)} percent of the way from where the goal started to the target`}
              >
                <div className="absolute inset-y-0 left-0 rounded-full bg-[var(--marigold)]" style={{ width: `${p.progress * 100}%` }} />
                {projectedPct != null && (
                  <span
                    className="absolute top-1/2 -mt-[5px] -ml-[5px] w-2.5 h-2.5 rounded-full bg-text"
                    style={{ left: `${projectedPct * 100}%` }}
                    title="Where your current pace lands you"
                  />
                )}
              </div>
              <div className="mt-2.5 flex flex-wrap justify-between gap-x-6 gap-y-1 text-[12px] text-text-2 tabular">
                <span>
                  Started <M cents={goal.startCents} />
                </span>
                {p.projected != null && (
                  <span>
                    Projected {deadlineLabel(goal.deadline)} <span className="text-text font-medium"><M cents={p.projected} /></span>
                  </span>
                )}
                <span>
                  Target <span className="text-text font-medium"><M cents={goal.targetCents} /></span>
                </span>
              </div>
            </div>
          ) : (
            <p className="mt-6 max-w-[46ch] text-[14px] text-text-2">
              Set a net worth to reach by Dec 31 and every band below this one starts answering whether you will get there.
            </p>
          )}
        </div>

        <div className="lg:w-[290px] lg:flex-none lg:border-l lg:border-border lg:pl-9 flex flex-col gap-2.5">
          {p && Icon ? (
            <>
              <span className="self-start inline-flex items-center gap-1.5 rounded-full bg-text px-2.5 py-0.5 text-[12px] font-semibold text-[var(--hero-bg)]">
                <Icon size={13} strokeWidth={2.5} aria-hidden="true" />
                {GOAL_STATUS_LABEL[p.status]}
              </span>
              <span className="font-display text-[28px] leading-tight text-text tabular">
                <VerdictNumber summary={summary!} />
              </span>
              <p className="m-0 text-[13px] text-text-2 tabular">
                <VerdictLine summary={summary!} />
              </p>
              <Link href="/goals" className="mt-1 text-[13px] font-medium text-text underline underline-offset-2">
                Your goal
              </Link>
            </>
          ) : (
            <Link
              href="/goals"
              className="ui-btn self-start inline-flex items-center h-9 px-4 rounded-control bg-text text-[15px] font-medium text-[var(--hero-bg)]"
            >
              Set a goal
            </Link>
          )}
        </div>
      </div>
    </Card>
  );
}
