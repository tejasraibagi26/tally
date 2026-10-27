import { and, eq, isNull } from "drizzle-orm";
import { db, schema } from "@/db";
import { cashFlowTrend, categoryBreakdown } from "@/lib/analytics";
import { netWorthTrend } from "@/lib/networth";
import { todayFor } from "@/lib/userTimezone";
import { shiftMonth } from "@tally/core/budgetMath";
import { PACE_MONTHS, defaultDeadline, netWorthPace, projectGoal, savingPace, suggestCuts, type Cut, type GoalProjection } from "@tally/core/goalMath";

/**
 * Year-end goals (Tally Pop only; DESIGN.md §1a, the Year-End Goals spec):
 * one active net worth goal per user. The math is @tally/core/goalMath;
 * this file loads what it needs -- net worth history (current value and
 * pace), cash flow (the saving part) and category spend (suggested cuts).
 */
export interface GoalRow {
  id: string;
  targetCents: number;
  startCents: number;
  startDate: string;
  deadline: string;
}

export interface GoalSummary {
  goal: GoalRow;
  projection: GoalProjection;
  /** Off track only: where the shortfall could come from. */
  cuts: Cut[];
}

export async function activeGoal(userId: string): Promise<GoalRow | null> {
  const [row] = await db
    .select({ id: schema.goals.id, targetCents: schema.goals.targetCents, startCents: schema.goals.startCents, startDate: schema.goals.startDate, deadline: schema.goals.deadline })
    .from(schema.goals)
    .where(and(eq(schema.goals.userId, userId), isNull(schema.goals.archivedAt)))
    .limit(1);
  return row ?? null;
}

/** Average monthly spend per category over the last PACE_MONTHS full months. */
async function categoryAverages(userId: string, today: string) {
  const current = `${today.slice(0, 7)}-01`;
  const months = Array.from({ length: PACE_MONTHS }, (_, i) => shiftMonth(current, -(i + 1)));
  const totals = new Map<string, { label: string; total: number }>();
  for (const rows of await Promise.all(months.map((m) => categoryBreakdown(userId, m)))) {
    for (const r of rows) {
      const prev = totals.get(r.key);
      totals.set(r.key, { label: r.label, total: (prev?.total ?? 0) + r.total });
    }
  }
  return [...totals.entries()].map(([key, v]) => ({ key, label: v.label, avgMonthly: Math.round(v.total / PACE_MONTHS) }));
}

export async function goalSummary(userId: string): Promise<GoalSummary | null> {
  const goal = await activeGoal(userId);
  if (!goal) return null;
  const today = await todayFor(userId);
  const [points, cashFlow] = await Promise.all([netWorthTrend(userId, 200), cashFlowTrend(userId, PACE_MONTHS + 2)]);
  const current = points.at(-1)?.net ?? goal.startCents;
  const projection = projectGoal({
    target: goal.targetCents,
    start: goal.startCents,
    current,
    deadline: goal.deadline,
    today,
    pace: netWorthPace(points, today),
    saving: savingPace(cashFlow, today),
  });
  const cuts = projection.shortBy ? suggestCuts(await categoryAverages(userId, today), projection.shortBy) : [];
  return { goal, projection, cuts };
}

/**
 * Sets the year's goal. With an active goal, changes its target/deadline and
 * keeps where it started; otherwise starts one from today's net worth.
 */
export async function saveGoal(userId: string, input: { targetCents: number; deadline?: string }): Promise<GoalRow> {
  const today = await todayFor(userId);
  const deadline = input.deadline ?? defaultDeadline(today);
  const existing = await activeGoal(userId);
  if (existing) {
    await db.update(schema.goals).set({ targetCents: input.targetCents, deadline }).where(eq(schema.goals.id, existing.id));
    return { ...existing, targetCents: input.targetCents, deadline };
  }
  const points = await netWorthTrend(userId, 1);
  const startCents = points.at(-1)?.net ?? 0;
  const [row] = await db
    .insert(schema.goals)
    .values({ userId, targetCents: input.targetCents, startCents, startDate: today, deadline })
    .returning({ id: schema.goals.id, targetCents: schema.goals.targetCents, startCents: schema.goals.startCents, startDate: schema.goals.startDate, deadline: schema.goals.deadline });
  return row!;
}

/** Removes the goal (archived, so history stays). */
export async function archiveGoal(userId: string): Promise<void> {
  await db.update(schema.goals).set({ archivedAt: new Date() }).where(and(eq(schema.goals.userId, userId), isNull(schema.goals.archivedAt)));
}

/** Whether the one-time year-end goals announcement was dismissed (users.goals_intro_seen_at). */
export async function goalsIntroSeen(userId: string): Promise<boolean> {
  const [row] = await db.select({ seen: schema.users.goalsIntroSeenAt }).from(schema.users).where(eq(schema.users.id, userId)).limit(1);
  return row?.seen != null;
}

/** Records the dismissal: the announcement never shows again; Overview's "Set a goal" card stays until there is one. */
export async function markGoalsIntroSeen(userId: string): Promise<void> {
  await db.update(schema.users).set({ goalsIntroSeenAt: new Date() }).where(and(eq(schema.users.id, userId), isNull(schema.users.goalsIntroSeenAt)));
}
