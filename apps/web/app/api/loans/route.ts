import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/session";
import { loansForUser, loanLabel } from "@/lib/loans";

/** Every non-card debt with the lender's detail (lib/loans.ts), for mobile's Loans screen. */
export async function GET(req: Request) {
  let userId: string;
  try {
    userId = await requireUserId(req);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const loans = await loansForUser(userId);
  return NextResponse.json({ loans: loans.map((l) => ({ ...l, label: loanLabel(l) })) });
}
