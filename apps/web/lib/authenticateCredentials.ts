import bcrypt from "bcryptjs";
import { db, schema } from "@/db";
import { eq } from "drizzle-orm";

// A cost-12 hash of a throwaway string, matching create-user.ts and the
// password-change route. Nothing ever verifies against it successfully.
const DUMMY_HASH = "$2a$12$2ORkQ2EK5JRA5TX6cj4rPuA3dNYl1T5XI.eBYVKHZKfM/d2AKtnbS";

/** Shared by NextAuth's Credentials provider (lib/auth.ts) and the mobile
 * login route (app/api/auth/mobile/login) — one place that knows how an
 * email/password pair maps to a user, so the two auth surfaces can't drift. */
export async function authenticateCredentials(
  email: string,
  password: string,
): Promise<{ id: string; email: string; name: string | null } | null> {
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

  return { id: user.id, email: user.email, name: user.name };
}
