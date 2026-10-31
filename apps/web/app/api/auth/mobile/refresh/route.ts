import { NextResponse } from "next/server";
import { z } from "zod";
import { and, eq, isNull } from "drizzle-orm";
import { db, schema } from "@/db";
import { recordAudit } from "@/lib/audit";
import { signAccessToken, generateRefreshToken, hashRefreshToken, REFRESH_TOKEN_TTL_MS } from "@/lib/mobileAuth";

const bodySchema = z.object({ refreshToken: z.string().min(1) });

const REUSE_GRACE_MS = 30_000;

// Refresh-token rotation: each use revokes the presented token and issues a
// new one, so a stolen-but-unused refresh token silently stops working the
// next time the legitimate device refreshes (its rotated token no longer
// matches what the thief has).
export async function POST(req: Request) {
  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const hash = hashRefreshToken(parsed.data.refreshToken);

  const result = await db.transaction(async (tx) => {
    const [row] = await tx
      .select()
      .from(schema.mobileRefreshTokens)
      .where(eq(schema.mobileRefreshTokens.tokenHash, hash))
      .limit(1);
    if (!row || row.expiresAt <= new Date()) return null;

    // An already-rotated token coming back means two parties hold this
    // chain -- the legitimate device and whoever copied it. There's no
    // telling which is which, so end every device's session and make both
    // sign in again; only the real owner knows the password. A retry within
    // a few seconds of the rotation is the device itself after a dropped
    // response, not a thief, so it just gets the 401.
    if (row.revokedAt) {
      if (Date.now() - row.revokedAt.getTime() < REUSE_GRACE_MS) return null;
      await tx
        .update(schema.mobileRefreshTokens)
        .set({ revokedAt: new Date() })
        .where(and(eq(schema.mobileRefreshTokens.userId, row.userId), isNull(schema.mobileRefreshTokens.revokedAt)));
      await recordAudit({ userId: row.userId, action: "mobile_refresh_token.reused", entity: "mobile_refresh_tokens", entityId: row.id });
      return null;
    }

    await tx
      .update(schema.mobileRefreshTokens)
      .set({ revokedAt: new Date() })
      .where(eq(schema.mobileRefreshTokens.id, row.id));

    const { token: refreshToken, hash: newHash } = generateRefreshToken();
    await tx.insert(schema.mobileRefreshTokens).values({
      userId: row.userId,
      tokenHash: newHash,
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
      deviceInfo: row.deviceInfo,
    });

    return { userId: row.userId, refreshToken };
  });

  if (!result) {
    return NextResponse.json({ error: "Invalid or expired refresh token" }, { status: 401 });
  }

  const { token: accessToken, expiresIn } = await signAccessToken(result.userId);
  return NextResponse.json({ accessToken, refreshToken: result.refreshToken, expiresIn });
}
