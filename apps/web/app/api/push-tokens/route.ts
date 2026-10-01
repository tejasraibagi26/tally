import { NextResponse } from "next/server";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireUserId } from "@/lib/session";

const tokenSchema = z.object({
  token: z.string().regex(/^(Exponent|Expo)PushToken\[.+\]$/),
  platform: z.enum(["ios", "android"]).optional(),
});

/**
 * Mobile registers its Expo push token after the user grants notification
 * permission (ALERTS.md §8), and removes it on sign-out. A token that moves
 * to another account (shared phone, re-login) is reassigned, not duplicated.
 */
export async function POST(req: Request) {
  let userId: string;
  try {
    userId = await requireUserId(req);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const parsed = tokenSchema.extend({ platform: z.enum(["ios", "android"]) }).safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  await db
    .insert(schema.pushTokens)
    .values({ userId, token: parsed.data.token, platform: parsed.data.platform })
    .onConflictDoUpdate({
      target: schema.pushTokens.token,
      set: { userId, platform: parsed.data.platform, lastSeenAt: new Date() },
    });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  let userId: string;
  try {
    userId = await requireUserId(req);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const parsed = tokenSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  await db.delete(schema.pushTokens).where(and(eq(schema.pushTokens.token, parsed.data.token), eq(schema.pushTokens.userId, userId)));
  return NextResponse.json({ ok: true });
}
