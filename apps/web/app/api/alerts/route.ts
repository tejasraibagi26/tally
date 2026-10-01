import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/session";
import { alertHistory } from "@/lib/alerts/history";

export async function GET(req: Request) {
  let userId: string;
  try {
    userId = await requireUserId(req);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const limit = Number(new URL(req.url).searchParams.get("limit") ?? 50) || 50;
  return NextResponse.json({ alerts: await alertHistory(userId, limit) });
}
