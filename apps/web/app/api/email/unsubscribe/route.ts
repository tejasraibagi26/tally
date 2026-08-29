import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { verifyUnsubscribeToken } from "@/lib/emailUnsubscribe";

const page = (body: string) => `<!DOCTYPE html>
<html><head><meta charset="utf-8" /><title>Tally</title>
<style>body{font-family:-apple-system,Segoe UI,Roboto,sans-serif;background:#F5F4F0;color:#1A1917;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;}
.card{background:#FCFCFB;border-radius:12px;padding:32px 40px;max-width:420px;text-align:center;}</style>
</head><body><div class="card">${body}</div></body></html>`;

// One-click unsubscribe (CAN-SPAM) — intentionally no auth required, only the
// signed token. GET (not POST) because this is what mail clients follow
// directly from the email's Unsubscribe link/header.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const userId = url.searchParams.get("uid");
  const token = url.searchParams.get("token");

  if (!userId || !token || !verifyUnsubscribeToken(userId, token)) {
    return new NextResponse(page("<p>This unsubscribe link is invalid or has expired.</p>"), {
      status: 400,
      headers: { "Content-Type": "text/html" },
    });
  }

  await db.update(schema.users).set({ recapsEnabled: false }).where(eq(schema.users.id, userId));

  return new NextResponse(page("<p>You won't get any more monthly recap emails from Tally.</p>"), {
    status: 200,
    headers: { "Content-Type": "text/html" },
  });
}
