import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/session";
import { tagSummaryFor } from "@/lib/tags";

/** One tag summed across categories, by day and by category (lib/tags.ts). */
export async function GET(req: Request, { params }: { params: Promise<{ tag: string }> }) {
  let userId: string;
  try {
    userId = await requireUserId(req);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { tag } = await params;
  return NextResponse.json(await tagSummaryFor(userId, decodeURIComponent(tag)));
}
