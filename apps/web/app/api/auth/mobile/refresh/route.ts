import { route } from "@/lib/log";
import { NextResponse } from "next/server";
import { z } from "zod";
import { and, eq, isNull } from "drizzle-orm";
import { db, schema } from "@/db";
import { recordAudit } from "@/lib/audit";
import { signAccessToken, generateRefreshToken, hashRefreshToken, REFRESH_TOKEN_TTL_MS } from "@/lib/mobileAuth";

const bodySchema = z.object({ refreshToken: z.string().min(1) });

/** A rotated token back this soon is the device itself after a dropped response, not a copy. */
const REUSE_GRACE_MS = 30_000;

type Row = typeof schema.mobileRefreshTokens.$inferSelect;

/** The device session a token belongs to. Rows from before families (migration 0038) are their own. */
const familyOf = (row: Row) => row.familyId ?? row.id;

/**
 * Refresh-token rotation, one device session ("family", set at login) at a
 * time. Each use replaces the presented token with a new one in the same
 * family. What happens when a token comes back is scoped to its own family,
 * so the user's other phones and web are never signed out by it:
 *
 * - Replaced within REUSE_GRACE_MS: the same device retrying after a lost
 *   response. It never stored the newer token, so the family moves on to a
 *   fresh one instead of signing the device out.
 * - Replaced longer ago: two parties hold this device's chain -- the device
 *   and a copy. That family ends; whoever is real signs in again.
 * - Revoked without being replaced (logout, its family ended, password or
 *   email change): just a 401. Before 2.14.2 this case also counted as
 *   reuse and ended every device, so two phones signed each other out in
 *   turn, each presenting the token the other's alarm had revoked.
 */
async function POST_handler(req: Request) {
  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const hash = hashRefreshToken(parsed.data.refreshToken);

  const result = await db.transaction(async (tx) => {
    const [row] = await tx.select().from(schema.mobileRefreshTokens).where(eq(schema.mobileRefreshTokens.tokenHash, hash)).limit(1);
    if (!row || row.expiresAt <= new Date()) return null;
    const family = familyOf(row);
    const liveInFamily = and(eq(schema.mobileRefreshTokens.familyId, family), isNull(schema.mobileRefreshTokens.revokedAt));

    if (row.revokedAt) {
      if (!row.replacedAt) return null;
      if (Date.now() - row.replacedAt.getTime() >= REUSE_GRACE_MS) {
        await tx.update(schema.mobileRefreshTokens).set({ revokedAt: new Date() }).where(liveInFamily);
        await recordAudit({ userId: row.userId, action: "mobile_refresh_token.reused", entity: "mobile_refresh_tokens", entityId: row.id });
        return null;
      }
      // Within the grace window: retire whatever replaced it and issue anew below.
      await tx.update(schema.mobileRefreshTokens).set({ revokedAt: new Date(), replacedAt: new Date() }).where(liveInFamily);
    } else {
      await tx.update(schema.mobileRefreshTokens).set({ revokedAt: new Date(), replacedAt: new Date() }).where(eq(schema.mobileRefreshTokens.id, row.id));
    }

    const { token: refreshToken, hash: newHash } = generateRefreshToken();
    await tx.insert(schema.mobileRefreshTokens).values({
      userId: row.userId,
      tokenHash: newHash,
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
      deviceInfo: row.deviceInfo,
      familyId: family,
    });

    return { userId: row.userId, refreshToken };
  });

  if (!result) {
    return NextResponse.json({ error: "Invalid or expired refresh token" }, { status: 401 });
  }

  const [user] = await db.select({ sessionVersion: schema.users.sessionVersion }).from(schema.users).where(eq(schema.users.id, result.userId)).limit(1);
  if (!user) return NextResponse.json({ error: "Invalid or expired refresh token" }, { status: 401 });
  const { token: accessToken, expiresIn } = await signAccessToken(result.userId, user.sessionVersion);
  return NextResponse.json({ accessToken, refreshToken: result.refreshToken, expiresIn });
}

export const POST = route(POST_handler);
