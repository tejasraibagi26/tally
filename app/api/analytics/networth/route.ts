import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/session";
import { netWorthTrend } from "@/lib/networth";

const RANGE_DAYS: Record<string, number> = { "3m": 90, "6m": 180, "12m": 365, "24m": 730 };

export async function GET(req: Request) {
  let userId: string;
  try {
    userId = await requireUserId();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const range = new URL(req.url).searchParams.get("range") ?? "12m";
  const days = RANGE_DAYS[range] ?? RANGE_DAYS["12m"]!;

  return NextResponse.json({ range, points: await netWorthTrend(userId, days) });
}
