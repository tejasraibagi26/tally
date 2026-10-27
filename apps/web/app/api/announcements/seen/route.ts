import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUserId } from "@/lib/session";
import { ANNOUNCEMENTS, markAnnouncementSeen } from "@/lib/announcements";

const bodySchema = z.object({ key: z.enum(ANNOUNCEMENTS) });

/** A one-time announcement was dismissed (lib/announcements.ts); web and mobile. */
export async function POST(req: Request) {
  let userId: string;
  try {
    userId = await requireUserId(req);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  await markAnnouncementSeen(userId, parsed.data.key);
  return NextResponse.json({ ok: true });
}
