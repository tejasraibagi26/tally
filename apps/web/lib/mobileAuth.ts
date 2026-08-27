import { SignJWT, jwtVerify } from "jose";
import { randomBytes, createHash } from "node:crypto";

/** Bearer-token auth for the mobile app, parallel to (never touching)
 * NextAuth's own cookie session. A short-lived signed access token plus a
 * long-lived opaque refresh token (only its hash is ever stored — see
 * db/schema.ts's mobileRefreshTokens) so a compromised device can be
 * revoked by deleting one row, same posture as a stolen password hash. */

const ACCESS_TOKEN_TTL_SECONDS = 15 * 60; // 15 minutes
export const REFRESH_TOKEN_TTL_MS = 60 * 24 * 60 * 60 * 1000; // 60 days

function mobileJwtSecret(): Uint8Array {
  const secret = process.env.MOBILE_JWT_SECRET;
  if (!secret) throw new Error("MOBILE_JWT_SECRET is not set");
  return new TextEncoder().encode(secret);
}

export async function signAccessToken(userId: string): Promise<{ token: string; expiresIn: number }> {
  const token = await new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${ACCESS_TOKEN_TTL_SECONDS}s`)
    .sign(mobileJwtSecret());
  return { token, expiresIn: ACCESS_TOKEN_TTL_SECONDS };
}

/** Returns the userId if the access token is valid, otherwise null. Never throws. */
export async function verifyAccessToken(token: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, mobileJwtSecret());
    return typeof payload.sub === "string" ? payload.sub : null;
  } catch {
    return null;
  }
}

export function generateRefreshToken(): { token: string; hash: string } {
  const token = randomBytes(32).toString("base64url");
  return { token, hash: hashRefreshToken(token) };
}

export function hashRefreshToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
