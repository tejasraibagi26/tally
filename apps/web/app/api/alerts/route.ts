import { route } from "@/lib/log";
import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/session";
import { alertHistory } from "@/lib/alerts/history";

async function GET_handler(req: Request) {
  let userId: string;
  try {
    userId = await requireUserId(req);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const limit = Number(new URL(req.url).searchParams.get("limit") ?? 50) || 50;
  return NextResponse.json({ alerts: await alertHistory(userId, limit) });
}

export const GET = route(GET_handler);
