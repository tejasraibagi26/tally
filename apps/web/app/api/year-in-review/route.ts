import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/session";
import { todayFor } from "@/lib/userTimezone";
import { yearReviewFor } from "@/lib/yearReview";

/** Year in review (lib/yearReview.ts) for ?year=, this year by default; for mobile. */
export async function GET(req: Request) {
  let userId: string;
  try {
    userId = await requireUserId(req);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const thisYear = Number((await todayFor(userId)).slice(0, 4));
  const asked = Number(new URL(req.url).searchParams.get("year"));
  const year = Number.isInteger(asked) && asked >= 2000 && asked <= thisYear ? asked : thisYear;
  return NextResponse.json(await yearReviewFor(userId, year));
}
