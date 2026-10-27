import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/session";
import { markGoalsIntroSeen } from "@/lib/goals";

/** The one-time year-end goals announcement was dismissed (either button). */
export async function POST(req: Request) {
  let userId: string;
  try {
    userId = await requireUserId(req);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  await markGoalsIntroSeen(userId);
  return NextResponse.json({ ok: true });
}
