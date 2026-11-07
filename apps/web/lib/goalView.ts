import { eq } from "drizzle-orm";
import { db, schema } from "@/db";

/**
 * The goal view is opt-in per account (users.goal_view_at, migration 0042).
 *
 * Unlike the retired /new pilot, it is not a second app: there is no separate
 * route tree and no shell of its own. Opting in changes what /overview and
 * /budgets render, and adds data-skin="quiet" to <html> for the quieter
 * styling in globals.css. Every other page is untouched either way.
 */
export async function prefersGoalView(userId: string): Promise<boolean> {
  const [row] = await db.select({ at: schema.users.goalViewAt }).from(schema.users).where(eq(schema.users.id, userId)).limit(1);
  return row?.at != null;
}

/** Turns the goal view on (stamping now) or off (clearing the column). */
export async function setGoalView(userId: string, on: boolean): Promise<void> {
  await db.update(schema.users).set({ goalViewAt: on ? new Date() : null }).where(eq(schema.users.id, userId));
}
