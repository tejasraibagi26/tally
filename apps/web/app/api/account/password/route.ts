import { route } from "@/lib/log";
import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { and, eq, isNull, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireUserId } from "@/lib/session";
import { verifyCurrentPassword } from "@/lib/authenticateCredentials";
import { RATE_LIMITED_MESSAGE } from "@/lib/rateLimit";

const bodySchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
});

async function POST_handler(req: Request) {
  let userId: string;
  try {
    userId = await requireUserId(req);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "New password must be at least 8 characters" }, { status: 400 });
  }
  const { currentPassword, newPassword } = parsed.data;

  const [user] = await db.select().from(schema.users).where(eq(schema.users.id, userId)).limit(1);
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const valid = await verifyCurrentPassword(userId, user.passwordHash, currentPassword, req);
  if (valid === "rate_limited") {
    return NextResponse.json({ error: RATE_LIMITED_MESSAGE }, { status: 429 });
  }
  if (!valid) {
    return NextResponse.json({ error: "Current password is incorrect" }, { status: 403 });
  }

  const passwordHash = await bcrypt.hash(newPassword, 12);
  // Ends every session -- web JWTs and mobile access tokens via the
  // version bump (lib/session.ts), mobile refresh tokens by revoking them --
  // so whoever had the old password or a stolen device is out. Both apps
  // send the user back to sign in afterwards.
  await db
    .update(schema.users)
    .set({ passwordHash, sessionVersion: sql`${schema.users.sessionVersion} + 1` })
    .where(eq(schema.users.id, userId));
  await db
    .update(schema.mobileRefreshTokens)
    .set({ revokedAt: new Date() })
    .where(and(eq(schema.mobileRefreshTokens.userId, userId), isNull(schema.mobileRefreshTokens.revokedAt)));

  return NextResponse.json({ ok: true });
}

export const POST = route(POST_handler);
