import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/session";
import { cashFlowTrend } from "@/lib/analytics";

export async function GET(req: Request) {
  let userId: string;
  try {
    userId = await requireUserId();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const monthsParam = new URL(req.url).searchParams.get("months");
  const months = Math.min(36, Math.max(1, parseInt(monthsParam ?? "13", 10) || 13));

  return NextResponse.json({ months: await cashFlowTrend(userId, months) });
}
