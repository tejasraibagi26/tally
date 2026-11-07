import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";

/**
 * The new Tally is opt-in per account (users.new_ui_at). Opted-in users who
 * reach a classic page that has a new counterpart are sent to it; classic
 * pages without one (year in review, FIRE, advanced settings) stay put.
 */
export async function prefersNewUi(userId: string): Promise<boolean> {
  const [row] = await db.select({ at: schema.users.newUiAt }).from(schema.users).where(eq(schema.users.id, userId)).limit(1);
  return row?.at != null;
}

/** Call first thing in a classic page: redirects opted-in users to `to`. */
export async function sendToNewUi(userId: string, to: string): Promise<void> {
  if (await prefersNewUi(userId)) redirect(to);
}
