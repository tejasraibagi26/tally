import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { DEFAULT_TIMEZONE, isValidTimeZone, monthStartInZone, todayInZone } from "@tally/core/zonedDate";

/** The user's stored IANA timezone (users.timezone), or DEFAULT_TIMEZONE if it's missing or invalid. */
export async function getUserTimezone(userId: string): Promise<string> {
  const [row] = await db.select({ timezone: schema.users.timezone }).from(schema.users).where(eq(schema.users.id, userId)).limit(1);
  return isValidTimeZone(row?.timezone) ? row.timezone : DEFAULT_TIMEZONE;
}

/** YYYY-MM-01 of the user's current month, in their own timezone -- never the server's UTC month. */
export async function currentMonthFor(userId: string): Promise<string> {
  return monthStartInZone(await getUserTimezone(userId));
}

/** YYYY-MM-DD of the user's today, in their own timezone. */
export async function todayFor(userId: string): Promise<string> {
  return todayInZone(await getUserTimezone(userId));
}
