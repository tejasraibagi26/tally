import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUserId } from "@/lib/session";
import { budgetHistory } from "@/lib/budgets";

const schema = z.object({
  categoryId: z.string().uuid(),
  month: z.string().regex(/^\d{4}-\d{2}-01$/),
});

// Six months of one category's budget and spend, for the budget detail view.
export async function GET(req: Request) {
  let userId: string;
  try {
    userId = await requireUserId(req);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const sp = new URL(req.url).searchParams;
  const parsed = schema.safeParse({ categoryId: sp.get("categoryId"), month: sp.get("month") });
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  return NextResponse.json({ months: await budgetHistory(userId, parsed.data.categoryId, parsed.data.month) });
}
