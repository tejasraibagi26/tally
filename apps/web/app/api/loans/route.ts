import { route } from "@/lib/log";
import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/session";
import { loansForUser, loanLabel } from "@/lib/loans";

/** Every non-card debt with the lender's detail (lib/loans.ts), for mobile's Loans screen. */
async function GET_handler(req: Request) {
  let userId: string;
  try {
    userId = await requireUserId(req);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const loans = await loansForUser(userId);
  return NextResponse.json({ loans: loans.map((l) => ({ ...l, label: loanLabel(l) })) });
}

export const GET = route(GET_handler);
