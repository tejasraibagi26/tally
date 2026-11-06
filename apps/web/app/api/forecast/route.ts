import { route } from "@/lib/log";
import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/session";
import { forecastFor } from "@/lib/forecast";

/** The projected balance curve and its ledger (lib/forecast.ts), for web and mobile. */
async function GET_handler(req: Request) {
  let userId: string;
  try {
    userId = await requireUserId(req);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const days = new URL(req.url).searchParams.get("days");
  return NextResponse.json(await forecastFor(userId, days == null ? undefined : Number(days)));
}

export const GET = route(GET_handler);
