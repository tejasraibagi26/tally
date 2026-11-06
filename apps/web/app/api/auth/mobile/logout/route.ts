import { route } from "@/lib/log";
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
async function POST_handler(req: Request) {
  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const hash = hashRefreshToken(parsed.data.refreshToken);

  // Ends this device's session (its whole family), and nothing else: the
  // user's other phones and web stay signed in.
  const [row] = await db.select().from(schema.mobileRefreshTokens).where(eq(schema.mobileRefreshTokens.tokenHash, hash)).limit(1);
  if (row) {
    await db
      .update(schema.mobileRefreshTokens)
      .set({ revokedAt: new Date() })
      .where(
        and(
          isNull(schema.mobileRefreshTokens.revokedAt),
          row.familyId ? eq(schema.mobileRefreshTokens.familyId, row.familyId) : eq(schema.mobileRefreshTokens.id, row.id),
        ),
      );
  }

  return NextResponse.json({ ok: true });
}

export const POST = route(POST_handler);
