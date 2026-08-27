import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/session";
import { creditCardsForUser, utilizationFor } from "@/lib/liabilities";

export async function GET() {
  let userId: string;
  try {
    userId = await requireUserId();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const cards = await creditCardsForUser(userId);
  return NextResponse.json({ cards, utilization: utilizationFor(cards) });
}
