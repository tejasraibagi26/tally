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

/** `sessionVersion` is users.session_version at issue time; lib/session.ts
 * refuses the token once the column has moved past it. */
export async function signAccessToken(userId: string, sessionVersion: number): Promise<{ token: string; expiresIn: number }> {
  const token = await new SignJWT({ sub: userId, sv: sessionVersion })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${ACCESS_TOKEN_TTL_SECONDS}s`)
    .sign(mobileJwtSecret());
  return { token, expiresIn: ACCESS_TOKEN_TTL_SECONDS };
}

/** Returns the userId and its session version if the access token is
 * valid, otherwise null. Never throws. Tokens minted before session
 * versions existed carry no `sv` and count as 0, the column's default. */
export async function verifyAccessToken(token: string): Promise<{ userId: string; sessionVersion: number } | null> {
  try {
    const { payload } = await jwtVerify(token, mobileJwtSecret(), { algorithms: ["HS256"] });
    if (typeof payload.sub !== "string") return null;
    return { userId: payload.sub, sessionVersion: typeof payload.sv === "number" ? payload.sv : 0 };
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
