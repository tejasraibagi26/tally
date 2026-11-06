import { log } from "@switchyard/logger";
import { route } from "@/lib/log";
import { NextResponse } from "next/server";
import { and, eq, isNull, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { verifyEmailChangeToken } from "@/lib/emailChange";

// The confirm button on app/email-change (public in middleware.ts; the
// signed token is the auth). The page does the asking; this does the
// change and sends the browser back to the page with the outcome.

function backToPage(req: Request, params: Record<string, string>) {
  return NextResponse.redirect(new URL(`/email-change?${new URLSearchParams(params)}`, req.url), 303);
}

// Confirmation emails sent before the page existed link here directly.
async function GET_handler(req: Request) {
  const token = new URL(req.url).searchParams.get("token") ?? "";
  return backToPage(req, { token });
}

async function POST_handler(req: Request) {
  const token = new URL(req.url).searchParams.get("token") ?? "";
  const claims = token ? await verifyEmailChangeToken(token) : null;
  // The page shows "expired" for a token that doesn't verify or was used.
  if (!claims) return backToPage(req, { token });

  // Single use: once the email has moved (by this link or any other way),
  // `from` no longer matches and the link is dead.
  const [user] = await db.select({ email: schema.users.email }).from(schema.users).where(eq(schema.users.id, claims.userId)).limit(1);
  if (!user || user.email !== claims.from) return backToPage(req, { token });

  try {
    // Every session was issued under the old email; bumping the version
    // (lib/session.ts) sends each device back to sign in with the new one.
    await db
      .update(schema.users)
      .set({ email: claims.to, sessionVersion: sql`${schema.users.sessionVersion} + 1` })
      .where(and(eq(schema.users.id, claims.userId), eq(schema.users.email, claims.from)));
  } catch (err) {
    // Unique constraint: someone took the address since the link was sent.
    log.error("email change confirm failed", err);
    return backToPage(req, { status: "taken" });
  }
  await db
    .update(schema.mobileRefreshTokens)
    .set({ revokedAt: new Date() })
    .where(and(eq(schema.mobileRefreshTokens.userId, claims.userId), isNull(schema.mobileRefreshTokens.revokedAt)));

  return backToPage(req, { status: "done", token });
}

export const GET = route(GET_handler);
export const POST = route(POST_handler);
