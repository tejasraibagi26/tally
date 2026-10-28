import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/session";
import { todayFor } from "@/lib/userTimezone";
import { yearReviewFor } from "@/lib/yearReview";
import { latestCompleteYear } from "@tally/core/yearReview";

/** Year in review (lib/yearReview.ts) for ?year=, the latest finished year by default; for mobile. */
export async function GET(req: Request) {
  let userId: string;
  try {
    userId = await requireUserId(req);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  // Whole years only, as on web: the latest finished year by default and at most.
  const lastYear = latestCompleteYear(await todayFor(userId));
  const asked = Number(new URL(req.url).searchParams.get("year"));
  const year = Number.isInteger(asked) && asked >= 2000 && asked <= lastYear ? asked : lastYear;
  return NextResponse.json(await yearReviewFor(userId, year));
}
