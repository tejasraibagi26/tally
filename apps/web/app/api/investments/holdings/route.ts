import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/session";
import { latestHoldingsForUser, portfolioValue, allocationFor, unrealizedGain, portfolioSimpleReturn } from "@/lib/portfolio";

// ?asOf is accepted per WORK.md §10 but not yet implemented as a historical
// lookup — holdings snapshots only started accumulating with M5, so there's
// no meaningful history to query yet. Always returns the latest snapshot.
export async function GET(req: Request) {
  let userId: string;
  try {
    userId = await requireUserId(req);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const holdings = await latestHoldingsForUser(userId);
  const [gain, simpleReturn] = await Promise.all([
    Promise.resolve(unrealizedGain(holdings)),
    portfolioSimpleReturn(userId),
  ]);

  return NextResponse.json({
    holdings,
    value: portfolioValue(holdings),
    allocation: allocationFor(holdings),
    unrealizedGain: gain,
    simpleReturn,
  });
}
