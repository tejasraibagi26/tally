import { NextResponse } from "next/server";
import { z } from "zod";
import { db, schema } from "@/db";
import { authenticateWithRateLimit } from "@/lib/authenticateCredentials";
import { RATE_LIMITED_MESSAGE } from "@/lib/rateLimit";
import { signAccessToken, generateRefreshToken, REFRESH_TOKEN_TTL_MS } from "@/lib/mobileAuth";

const bodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  deviceInfo: z.string().optional(),
});

// Mobile's entry point into the same credentials NextAuth's web login uses
// (lib/authenticateCredentials.ts) — but issues a bearer token pair instead
// of a browser session cookie. Excluded from middleware's cookie gate by the
// existing "api/auth" matcher exclusion (middleware.ts).
export async function POST(req: Request) {
  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const { email, password, deviceInfo } = parsed.data;

  const user = await authenticateWithRateLimit(email, password, req);
  if (user === "rate_limited") {
    return NextResponse.json({ error: RATE_LIMITED_MESSAGE, code: "rate_limited" }, { status: 429 });
  }
  if (!user) {
    return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
  }

  const { token: accessToken, expiresIn } = await signAccessToken(user.id, user.sessionVersion);
  const { token: refreshToken, hash } = generateRefreshToken();

  await db.insert(schema.mobileRefreshTokens).values({
    userId: user.id,
    tokenHash: hash,
    expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
    deviceInfo: deviceInfo ?? null,
  });

  return NextResponse.json({
    accessToken,
    refreshToken,
    expiresIn,
    user: { id: user.id, email: user.email, name: user.name },
  });
}
