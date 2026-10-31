import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { verifyUnsubscribeToken } from "@/lib/emailUnsubscribe";
import { loadAlertPreferences, ALERT_TYPES } from "@/lib/alerts/preferences";

// The unsubscribe button on app/unsubscribe (public in middleware.ts; the
// signed token is the auth). The page does the asking; this turns the
// emails off and sends the browser back to the page to say so.

// Emails sent before the page existed link here directly.
export async function GET(req: Request) {
  return NextResponse.redirect(new URL(`/unsubscribe${new URL(req.url).search}`, req.url), 303);
}

export async function POST(req: Request) {
  const url = new URL(req.url);
  const userId = url.searchParams.get("uid");
  const token = url.searchParams.get("token");
  if (!userId || !token || !verifyUnsubscribeToken(userId, token)) return NextResponse.redirect(new URL(`/unsubscribe${url.search}`, req.url), 303);

  // `kind=alerts` (lib/alerts/email.ts) turns off email for every alert type
  // and leaves the monthly recap alone.
  if (url.searchParams.get("kind") === "alerts") {
    const { prefs } = await loadAlertPreferences(userId);
    const channels = Object.fromEntries(ALERT_TYPES.map((t) => [t, { ...prefs.channels[t], email: false }]));
    await db.update(schema.alertPreferences).set({ channels, updatedAt: new Date() }).where(eq(schema.alertPreferences.userId, userId));
    return NextResponse.redirect(new URL("/unsubscribe?status=done&kind=alerts", req.url), 303);
  }

  await db.update(schema.users).set({ recapsEnabled: false }).where(eq(schema.users.id, userId));
  return NextResponse.redirect(new URL("/unsubscribe?status=done", req.url), 303);
}
