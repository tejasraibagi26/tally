import { formatCents } from "@tally/core/money";
import type { GoalStatus } from "@tally/core/goalMath";
import type { GoalSummary } from "@/lib/goals";

/**
 * The year-end goal's words, shared by the Overview card, the Goals page,
 * the off-track alert and the recap email so they all say the same thing.
 */
export const GOAL_STATUS_LABEL: Record<GoalStatus, string> = {
  on_track: "On track",
  off_track: "Off track",
  reached: "Reached",
  ended: "Deadline passed",
  unknown: "Needs a month of history",
};

export function deadlineLabel(deadline: string): string {
  return new Date(`${deadline}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

/** One plain line under the verdict: the projection, or what it takes. */
export function goalLine({ projection: p, goal }: GoalSummary): string {
  const by = deadlineLabel(goal.deadline);
  if (p.status === "reached") return `You passed ${formatCents(p.target)} with ${formatCents(p.current - p.target)} to spare.`;
  if (p.status === "ended") return `Ended ${formatCents(p.gap)} short of the target.`;
  if (p.status === "unknown") return `Needs ${formatCents(Math.round(p.neededPerMonth ?? 0))} a month to get there by ${by}.`;
  if (p.status === "on_track") return `Projected ${by}: ${formatCents(Math.round(p.projected!))}.`;
  return `Projected ${by}: ${formatCents(Math.round(p.projected!))}. ${formatCents(Math.round(p.shortBy!))} more a month closes it.`;
}
