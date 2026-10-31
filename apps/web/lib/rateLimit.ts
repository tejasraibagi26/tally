import { and, eq, gte, inArray, lt, sql } from "drizzle-orm";
import { db, schema } from "@/db";

/**
 * Brute-force brake for anything that checks a password: web and mobile
 * sign-in, and the current-password checks on account changes. Failures
 * are rows in auth_attempts, keyed by what's being guessed at and by who's
 * guessing, so a slow spray across many emails trips the IP limit and a
 * botnet on one account trips the account limit.
 */

const WINDOW_MS = 15 * 60 * 1000;

/** Failures allowed per key in WINDOW_MS before that key is refused. */
const LIMITS = { email: 10, user: 10, ip: 50 } as const;
type Kind = keyof typeof LIMITS;

export function attemptKey(kind: Kind, value: string): string {
  return `${kind}:${value.trim().toLowerCase()}`;
}

/** The caller's IP as Vercel's edge reports it (first x-forwarded-for hop). */
export function clientIp(req: Request): string | null {
  const forwarded = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || req.headers.get("x-real-ip") || null;
}

/** Keys for a sign-in attempt: the email, plus the IP when there is one. */
export function signInKeys(email: string, req: Request | undefined): string[] {
  const ip = req ? clientIp(req) : null;
  return [attemptKey("email", email), ...(ip ? [attemptKey("ip", ip)] : [])];
}

function limitFor(key: string): number {
  return LIMITS[key.slice(0, key.indexOf(":")) as Kind] ?? LIMITS.email;
}

/** True when any key has used up its failures for the current window. */
export async function isRateLimited(keys: string[]): Promise<boolean> {
  if (keys.length === 0) return false;
  const rows = await db
    .select({ key: schema.authAttempts.key, n: sql<number>`count(*)::int` })
    .from(schema.authAttempts)
    .where(and(inArray(schema.authAttempts.key, keys), gte(schema.authAttempts.createdAt, new Date(Date.now() - WINDOW_MS))))
    .groupBy(schema.authAttempts.key);
  return rows.some((r) => r.n >= limitFor(r.key));
}

export async function recordFailure(keys: string[]): Promise<void> {
  if (keys.length === 0) return;
  await db.insert(schema.authAttempts).values(keys.map((key) => ({ key })));
}

/** A correct password clears the account's count (never the IP's). */
export async function clearFailures(key: string): Promise<void> {
  await db.delete(schema.authAttempts).where(eq(schema.authAttempts.key, key));
}

/** Nightly cron: rows older than the window can never count again. */
export async function pruneAuthAttempts(): Promise<void> {
  await db.delete(schema.authAttempts).where(lt(schema.authAttempts.createdAt, new Date(Date.now() - WINDOW_MS)));
}

export const RATE_LIMITED_MESSAGE = "Too many attempts. Wait 15 minutes and try again.";
