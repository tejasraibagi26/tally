import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/session";
import { categoryBreakdown, merchantBreakdown } from "@/lib/analytics";

function currentMonth(): string {
  const now = new Date();
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1)).toISOString().slice(0, 10);
}

export async function GET(req: Request) {
  let userId: string;
  try {
    userId = await requireUserId(req);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const month = /^\d{4}-\d{2}-01$/.test(url.searchParams.get("month") ?? "") ? url.searchParams.get("month")! : currentMonth();
  const groupBy = url.searchParams.get("groupBy") === "merchant" ? "merchant" : "category";

  const rows = groupBy === "merchant" ? await merchantBreakdown(userId, month) : await categoryBreakdown(userId, month);
  return NextResponse.json({ month, groupBy, rows });
}
