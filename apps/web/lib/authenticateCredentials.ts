import bcrypt from "bcryptjs";
import { db, schema } from "@/db";
import { eq } from "drizzle-orm";
import { attemptKey, clearFailures, clientIp, isRateLimited, recordFailure, signInKeys } from "@/lib/rateLimit";

// A cost-12 hash of a throwaway string, matching create-user.ts and the
// password-change route. Nothing ever verifies against it successfully.
const DUMMY_HASH = "$2a$12$2ORkQ2EK5JRA5TX6cj4rPuA3dNYl1T5XI.eBYVKHZKfM/d2AKtnbS";

/** Shared by NextAuth's Credentials provider (lib/auth.ts) and the mobile
 * login route (app/api/auth/mobile/login) — one place that knows how an
 * email/password pair maps to a user, so the two auth surfaces can't drift. */
export async function authenticateCredentials(
  email: string,
  password: string,
): Promise<{ id: string; email: string; name: string | null; sessionVersion: number } | null> {
  const [user] = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.email, email.toLowerCase()))
    .limit(1);
  if (!user) {
    // Same bcrypt cost as a real check, so response time doesn't tell an
    // attacker which emails have accounts.
    await bcrypt.compare(password, DUMMY_HASH);
    return null;
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) return null;

  return { id: user.id, email: user.email, name: user.name, sessionVersion: user.sessionVersion };
}

/** authenticateCredentials behind lib/rateLimit.ts: refuses outright once
 * the email or the caller's IP has too many recent failures, records each
 * new failure, and clears the email's count on success. Both sign-in
 * surfaces call this, never the bare function. */
export async function authenticateWithRateLimit(
  email: string,
  password: string,
  req: Request | undefined,
): Promise<{ id: string; email: string; name: string | null; sessionVersion: number } | "rate_limited" | null> {
  const keys = signInKeys(email, req);
  if (await isRateLimited(keys)) return "rate_limited";
  const user = await authenticateCredentials(email, password);
  if (!user) {
    await recordFailure(keys);
    return null;
  }
  await clearFailures(keys[0]!);
  return user;
}

/** The "type your current password" check on account changes, limited per
 * account and IP so a stolen session can't be used to guess the password. */
export async function verifyCurrentPassword(
  userId: string,
  passwordHash: string,
  password: string,
  req: Request,
): Promise<boolean | "rate_limited"> {
  const ip = clientIp(req);
  const keys = [attemptKey("user", userId), ...(ip ? [attemptKey("ip", ip)] : [])];
  if (await isRateLimited(keys)) return "rate_limited";
  const valid = await bcrypt.compare(password, passwordHash);
  if (!valid) await recordFailure(keys);
  else await clearFailures(keys[0]!);
  return valid;
}
