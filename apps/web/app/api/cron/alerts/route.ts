import { NextResponse } from "next/server";
import { db, schema } from "@/db";
import { isAuthorizedCronRequest } from "@/lib/cronAuth";
import { evaluateUserSweep } from "@/lib/alerts/evaluate";
import { flushPendingAlerts } from "@/lib/alerts/engine";

export const maxDuration = 300;

// Daily (vercel.json: 13:00 UTC, ≈9 AM Eastern), ALERTS.md §3: a sweep per
// user for connections, budget steps reached outside a sync (manual entries,
// Shortcuts, recategorizing) and subscription changes; then sends push held
// overnight by quiet hours and retries recent failed sends.
export async function GET(req: Request) {
  if (!isAuthorizedCronRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const users = await db.select({ id: schema.users.id }).from(schema.users);
  let swept = 0;
  for (const u of users) {
    try {
      swept += await evaluateUserSweep(u.id);
    } catch (err) {
      console.error(`Cron alerts: sweep failed for user ${u.id}`, err);
    }
  }

  let flushed = 0;
  try {
    flushed = await flushPendingAlerts();
  } catch (err) {
    console.error("Cron alerts: flush failed", err);
  }

  return NextResponse.json({ ok: true, users: users.length, swept, flushed });
}
