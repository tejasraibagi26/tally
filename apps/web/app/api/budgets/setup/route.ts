import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUserId } from "@/lib/session";
import { applyBudgetRows, budgetSetupOptions } from "@/lib/budgets";

const schema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}-01$/, "month must be YYYY-MM-01"),
  source: z.enum(["copy", "average"]),
});

// Fills an empty month in one tap: copy last month's budgets, or set each
// category to its 3-month average. Never overwrites an existing budget.
export async function POST(req: Request) {
  let userId: string;
  try {
    userId = await requireUserId(req);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request", issues: parsed.error.issues }, { status: 400 });

  const { month, source } = parsed.data;
  const options = await budgetSetupOptions(userId, month);
  const option = source === "copy" ? options.copy : options.average;
  if (!option) return NextResponse.json({ error: "Nothing to set up from" }, { status: 409 });
  const created = await applyBudgetRows(userId, month, option.rows);
  return NextResponse.json({ ok: true, created });
}
