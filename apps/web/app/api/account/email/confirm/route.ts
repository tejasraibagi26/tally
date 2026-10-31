import { NextResponse } from "next/server";
import { and, eq, isNull, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { verifyEmailChangeToken } from "@/lib/emailChange";

const page = (body: string, status = 200) =>
  new NextResponse(
    `<!DOCTYPE html>
<html><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><title>Tally</title>
<style>body{font-family:-apple-system,Segoe UI,Roboto,sans-serif;background:#F1F0EC;color:#1A1917;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:16px;}
.card{background:#FFFFFF;border-radius:12px;padding:32px 40px;max-width:420px;text-align:center;}
button{margin-top:12px;padding:10px 20px;border:0;border-radius:8px;background:#1A1917;color:#fff;font-size:15px;cursor:pointer}</style>
</head><body><div class="card">${body}</div></body></html>`,
    { status, headers: { "Content-Type": "text/html" } },
  );

const invalid = () => page("<p>This link is invalid or has expired. Change your email again from Settings to get a new one.</p>", 400);

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// The link from lib/emailChange.ts's confirmation email. Public in
// middleware.ts -- it's often opened on a phone that isn't signed in; the
// signed token is the auth. GET only asks (mail filters pre-fetch links);
// the button POSTs and that makes the change.
export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get("token");
  const claims = token ? await verifyEmailChangeToken(token) : null;
  if (!token || !claims) return invalid();

  return page(`<p>Make <strong>${esc(claims.to)}</strong> your Tally sign-in email?</p>
<form method="post" action="/api/account/email/confirm?token=${encodeURIComponent(token)}"><button type="submit">Confirm</button></form>`);
}

export async function POST(req: Request) {
  const token = new URL(req.url).searchParams.get("token");
  const claims = token ? await verifyEmailChangeToken(token) : null;
  if (!claims) return invalid();

  // Single use: once the email has moved (by this link or any other way),
  // `from` no longer matches and the link is dead.
  const [user] = await db.select({ email: schema.users.email }).from(schema.users).where(eq(schema.users.id, claims.userId)).limit(1);
  if (!user || user.email !== claims.from) return invalid();

  try {
    // Every session was issued under the old email; bumping the version
    // (lib/session.ts) sends each device back to sign in with the new one.
    await db
      .update(schema.users)
      .set({ email: claims.to, sessionVersion: sql`${schema.users.sessionVersion} + 1` })
      .where(and(eq(schema.users.id, claims.userId), eq(schema.users.email, claims.from)));
  } catch (err) {
    // Unique constraint: someone took the address since the link was sent.
    console.error("email change confirm failed", err);
    return page("<p>That email is already in use by another account.</p>", 409);
  }
  await db
    .update(schema.mobileRefreshTokens)
    .set({ revokedAt: new Date() })
    .where(and(eq(schema.mobileRefreshTokens.userId, claims.userId), isNull(schema.mobileRefreshTokens.revokedAt)));

  return page(`<p>Done — sign in to Tally with <strong>${esc(claims.to)}</strong> from now on.</p>`);
}
