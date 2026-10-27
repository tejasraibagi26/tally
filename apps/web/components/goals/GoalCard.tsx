import Link from "next/link";
import { AlertTriangle, CheckCircle2, Clock, Flag, Target } from "lucide-react";
import { formatCents } from "@tally/core/money";
import type { GoalStatus } from "@tally/core/goalMath";
import { Card } from "@/components/ui/Card";
import type { GoalSummary } from "@/lib/goals";
import { cn } from "@/lib/cn";
import { GOAL_STATUS_LABEL, deadlineLabel, goalLine } from "@/lib/goalCopy";

/** The verdict as icon + words + color (never color alone). */
const STATUS_LOOK: Record<GoalStatus, { tone: string; icon: typeof CheckCircle2 }> = {
  on_track: { tone: "text-positive bg-positive-subtle", icon: CheckCircle2 },
  off_track: { tone: "text-warning bg-warning-subtle", icon: AlertTriangle },
  reached: { tone: "text-positive bg-positive-subtle", icon: Flag },
  ended: { tone: "text-text-2 bg-sunken", icon: Clock },
  unknown: { tone: "text-text-2 bg-sunken", icon: Clock },
};

/**
 * The year-end goal on Overview (Tally Pop only): progress from where it
 * started to the target, the verdict, and the pace behind it. Empty: one
 * line and one action.
 */
export function GoalCard({ summary, className }: { summary: GoalSummary | null; className?: string }) {
  if (!summary) {
    return (
      <Card className={cn("p-5 flex flex-wrap items-center gap-4", className)}>
        <span className="w-10 h-10 flex-none rounded-control bg-brand-subtle text-brand flex items-center justify-center" aria-hidden="true">
          <Target size={20} strokeWidth={2} />
        </span>
        <span className="flex-1 min-w-[200px] flex flex-col">
          <span className="font-bold text-[16px] text-text">Set a goal for the year</span>
          <span className="text-[14px] text-text-2">Pick a net worth to reach by Dec 31 and Tally tracks the pace.</span>
        </span>
        <Link href="/goals" className="ui-btn ui-btn-primary inline-flex items-center h-9 px-4 rounded-control bg-brand text-on-brand font-medium text-[15px] hover:bg-brand-hover">
          Set a goal
        </Link>
      </Card>
    );
  }
  const { projection: p, goal } = summary;
  const status = STATUS_LOOK[p.status];
  const projectedPct = p.projected != null && goal.targetCents > goal.startCents ? Math.min(1, Math.max(0, (p.projected - goal.startCents) / (goal.targetCents - goal.startCents))) : null;
  return (
    <Link href="/goals" className={cn("block", className)}>
      <Card className="p-5 lg:p-6 flex flex-col gap-3 hover:border-border-strong transition-colors">
        <span className="text-xs font-semibold uppercase tracking-[0.08em] text-text-2">Year-end goal</span>
        <span className="font-display text-[32px] leading-none text-text tabular">
          <span className="money">{formatCents(p.current)}</span> <span className="text-text-2 text-[22px]">of {formatCents(p.target)}</span>
        </span>
        <span className="text-[14px] text-text-2 tabular">
          {p.status === "reached" ? "Reached" : `${formatCents(p.gap)} to go by ${deadlineLabel(goal.deadline)}`}
        </span>
        <div className="ui-meter relative h-3 rounded-full bg-sunken overflow-hidden" role="img" aria-label={`${Math.round(p.progress * 100)}% of the way from where it started`}>
          <div className="h-full rounded-full bg-brand" style={{ width: `${p.progress * 100}%` }} />
          {projectedPct != null && <div className="absolute top-0 bottom-0 w-0 border-l-2 border-dashed border-text" style={{ left: `${projectedPct * 100}%` }} title="Where the pace lands by the deadline" />}
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[13px] font-semibold", status.tone)}>
            <status.icon size={14} strokeWidth={2.25} aria-hidden="true" /> {GOAL_STATUS_LABEL[p.status]}
          </span>
          <span className="text-[14px] text-text tabular">{goalLine(summary)}</span>
        </div>
        {p.pace != null && (
          <span className="text-[13px] text-text-2 tabular border-t border-border pt-3">
            Pace {formatCents(Math.round(p.pace))}/mo
            {p.saving != null && `: saving ${formatCents(Math.round(p.saving))}, markets and debt ${formatCents(Math.round(p.pace - p.saving))}`}
          </span>
        )}
      </Card>
    </Link>
  );
}

/**
 * Budgets' one line about the goal (Tally Pop, current month): spending is
 * where an off-track goal is won back, so the verdict sits beside it.
 */
export function GoalBudgetLine({ summary, className }: { summary: GoalSummary | null; className?: string }) {
  if (!summary) return null;
  const { projection: p } = summary;
  const status = STATUS_LOOK[p.status];
  const words =
    p.status === "off_track"
      ? `Year-end goal is off track: spending ${formatCents(Math.round(p.shortBy!))} less a month closes it.`
      : p.status === "on_track"
        ? `Year-end goal is on track, ${formatCents(p.gap)} to go. Staying on budget keeps it there.`
        : `Year-end goal: ${GOAL_STATUS_LABEL[p.status].toLowerCase()}.`;
  return (
    <Link href="/goals" className={cn("flex items-center gap-2 text-[14px] text-text hover:underline w-fit", className)}>
      <status.icon size={15} strokeWidth={2.25} className={status.tone.split(" ")[0]} aria-hidden="true" />
      <span className="tabular">{words}</span>
    </Link>
  );
}
