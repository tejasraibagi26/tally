import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { verifyUnsubscribeToken } from "@/lib/emailUnsubscribe";
import { loadAlertPreferences, ALERT_TYPES } from "@/lib/alerts/preferences";

const page = (body: string) => `<!DOCTYPE html>
<html><head><meta charset="utf-8" /><title>Tally</title>
<style>body{font-family:-apple-system,Segoe UI,Roboto,sans-serif;background:#F1F0EC;color:#1A1917;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;}
.card{background:#FFFFFF;border-radius:12px;padding:32px 40px;max-width:420px;text-align:center;}</style>
</head><body><div class="card">${body}</div></body></html>`;

function invalid() {
  return new NextResponse(page("<p>This unsubscribe link is invalid or has expired.</p>"), {
    status: 400,
    headers: { "Content-Type": "text/html" },
  });
}

function html(body: string) {
  return new NextResponse(page(body), { status: 200, headers: { "Content-Type": "text/html" } });
}

// Unsubscribe (CAN-SPAM) -- intentionally no auth required, only the signed
// token. Opening the link (GET) only asks; the button POSTs back here and
// that does it, so a mail filter that pre-fetches every link in an email
// can't unsubscribe anyone on its own.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const userId = url.searchParams.get("uid");
  const token = url.searchParams.get("token");
  if (!userId || !token || !verifyUnsubscribeToken(userId, token)) return invalid();

  const alerts = url.searchParams.get("kind") === "alerts";
  // Rebuilt from the verified values only -- never echo the raw query string.
  const action = `${url.pathname}?${new URLSearchParams({ uid: userId, token, ...(alerts ? { kind: "alerts" } : {}) }).toString().replace(/&/g, "&amp;")}`;
  return html(`<p>Stop getting ${alerts ? "alert emails" : "monthly recap emails"} from Tally?</p>
<form method="post" action="${action}">
<button type="submit" style="margin-top:12px;padding:10px 20px;border:0;border-radius:8px;background:#1A1917;color:#fff;font-size:15px;cursor:pointer">Unsubscribe</button>
</form>`);
}

export async function POST(req: Request) {
  const url = new URL(req.url);
  const userId = url.searchParams.get("uid");
  const token = url.searchParams.get("token");
  if (!userId || !token || !verifyUnsubscribeToken(userId, token)) return invalid();

  // `kind=alerts` (lib/alerts/email.ts) turns off email for every alert type
  // and leaves the monthly recap alone.
  if (url.searchParams.get("kind") === "alerts") {
    const { prefs } = await loadAlertPreferences(userId);
    const channels = Object.fromEntries(ALERT_TYPES.map((t) => [t, { ...prefs.channels[t], email: false }]));
    await db.update(schema.alertPreferences).set({ channels, updatedAt: new Date() }).where(eq(schema.alertPreferences.userId, userId));
    return html("<p>You won't get any more alert emails from Tally. Your monthly recap is unchanged.</p>");
  }

  await db.update(schema.users).set({ recapsEnabled: false }).where(eq(schema.users.id, userId));
  return html("<p>You won't get any more monthly recap emails from Tally.</p>");
}
