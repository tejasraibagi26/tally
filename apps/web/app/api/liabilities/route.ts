import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/session";
import { creditCardsForUser, institutionBrands, utilizationFor, viewForCard } from "@/lib/liabilities";
import { todayFor } from "@/lib/userTimezone";

export async function GET(req: Request) {
  let userId: string;
  try {
    userId = await requireUserId(req);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [cards, today] = await Promise.all([creditCardsForUser(userId), todayFor(userId)]);
  // Each card carries its statement-cycle view (@tally/core/cardView) so both
  // apps read paid / due / overdue the same way; brands go once per bank.
  return NextResponse.json({
    cards: cards.map((c) => ({ ...c, view: viewForCard(c, today) })),
    institutions: await institutionBrands(cards),
    utilization: await utilizationFor(cards),
  });
}
