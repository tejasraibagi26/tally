import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUserId } from "@/lib/session";
import { ALERT_TYPES, loadAlertPreferences } from "@/lib/alerts/preferences";
import { SAMPLE_ALERTS } from "@/lib/alerts/samples";
import { sendTestAlert } from "@/lib/alerts/engine";
import type { AlertType } from "@tally/core/alerts";

const bodySchema = z.object({ type: z.enum(ALERT_TYPES as [string, ...string[]]) });

/** Settings → "Send a test alert": a sample of one type, on whichever channels are on for it. */
export async function POST(req: Request) {
  let userId: string;
  try {
    userId = await requireUserId(req);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  const type = parsed.data.type as AlertType;

  const { prefs } = await loadAlertPreferences(userId);
  const ch = prefs.channels[type];
  if (!ch.push && !ch.email) {
    return NextResponse.json({ error: "Turn on push or email for this alert first." }, { status: 400 });
  }
  const result = await sendTestAlert(userId, SAMPLE_ALERTS[type]);
  return NextResponse.json({ ok: true, ...result, channels: ch });
}
