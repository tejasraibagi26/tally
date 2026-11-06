import { route } from "@/lib/log";
import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/session";
import { safeToSpendFor } from "@/lib/safeToSpend";

/** Safe to spend and its breakdown (lib/safeToSpend.ts), for web and mobile. */
async function GET_handler(req: Request) {
  let userId: string;
  try {
    userId = await requireUserId(req);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json(await safeToSpendFor(userId));
}

export const GET = route(GET_handler);
