import { NextResponse } from "next/server";
import { z } from "zod";
import { and, eq, isNull } from "drizzle-orm";
import { db, schema } from "@/db";
import { hashRefreshToken } from "@/lib/mobileAuth";

const bodySchema = z.object({ refreshToken: z.string().min(1) });

// Revokes one device's refresh token. Always succeeds from the client's
// perspective (the app clears its local tokens regardless) — this just
// makes the revocation server-side too, so a stolen refresh token can't be
// replayed after the legitimate user logs out.
export async function POST(req: Request) {
  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const hash = hashRefreshToken(parsed.data.refreshToken);

  await db
    .update(schema.mobileRefreshTokens)
    .set({ revokedAt: new Date() })
    .where(and(eq(schema.mobileRefreshTokens.tokenHash, hash), isNull(schema.mobileRefreshTokens.revokedAt)));

  return NextResponse.json({ ok: true });
}
