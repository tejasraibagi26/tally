import { NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireUserId } from "@/lib/session";
import { ALERT_TYPES, loadAlertPreferences } from "@/lib/alerts/preferences";

const channel = z.object({ email: z.boolean().optional() });
const patchSchema = z.object({
  channels: z.record(z.enum(ALERT_TYPES as [string, ...string[]]), channel).optional(),
  // $10 to $100,000
  largeTransactionCents: z.number().int().min(1_000).max(10_000_000).optional(),
});

export async function GET(req: Request) {
  let userId: string;
  try {
    userId = await requireUserId(req);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { prefs } = await loadAlertPreferences(userId);
  return NextResponse.json(prefs);
}

export async function PATCH(req: Request) {
  let userId: string;
  try {
    userId = await requireUserId(req);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  const { prefs } = await loadAlertPreferences(userId);
  const channels = { ...prefs.channels };
  for (const [type, patch] of Object.entries(parsed.data.channels ?? {})) {
    const t = type as keyof typeof channels;
    channels[t] = { ...channels[t], ...patch };
  }
  await db
    .update(schema.alertPreferences)
    .set({
      channels,
      largeTransactionCents: parsed.data.largeTransactionCents ?? prefs.largeTransactionCents,
      updatedAt: new Date(),
    })
    .where(eq(schema.alertPreferences.userId, userId));

  const { prefs: next } = await loadAlertPreferences(userId);
  return NextResponse.json(next);
}
