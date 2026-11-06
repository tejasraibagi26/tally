import { route } from "@/lib/log";
import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/session";
import { markGoalsIntroSeen } from "@/lib/goals";

/** The one-time year-end goals announcement was dismissed (either button). */
async function POST_handler(req: Request) {
  let userId: string;
  try {
    userId = await requireUserId(req);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  await markGoalsIntroSeen(userId);
  return NextResponse.json({ ok: true });
}

export const POST = route(POST_handler);
