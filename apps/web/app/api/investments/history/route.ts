import { route } from "@/lib/log";
import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/session";
import { portfolioHistory } from "@/lib/portfolio";

// Daily { date, value, invested } for the Investments chart (mobile; the web
// page calls portfolioHistory directly). Ranges are cut client-side with
// @tally/core/investments' summarizeRange, so one fetch serves every range.
async function GET_handler(req: Request) {
  let userId: string;
  try {
    userId = await requireUserId(req);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json({ points: await portfolioHistory(userId) });
}

export const GET = route(GET_handler);
