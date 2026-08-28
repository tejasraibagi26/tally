import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/session";
import { MOCK_MODE } from "@/lib/config";

// Lets the mobile app mirror app/(app)/accounts/page.tsx's `mock={MOCK_MODE}`
// branch on LinkButton -- MOCK_MODE is a server-only constant with no other
// way for a client to know whether "Add account" should skip real Plaid
// Link and hit /api/mock/connect instead (dev defaults to mock so there's
// no Plaid credentials requirement to run the app locally).
export async function GET(req: Request) {
  try {
    await requireUserId(req);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json({ mockMode: MOCK_MODE });
}
