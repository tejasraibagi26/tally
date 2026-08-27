import bcrypt from "bcryptjs";
import { db, schema } from "@/db";
import { eq } from "drizzle-orm";

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
  if (!user) return null;

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) return null;

  return { id: user.id, email: user.email, name: user.name };
}
