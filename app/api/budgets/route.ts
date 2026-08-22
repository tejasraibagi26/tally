import { NextResponse } from "next/server";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireUserId } from "@/lib/session";
import { getBudgetsForMonth } from "@/lib/budgets";

const monthSchema = z.string().regex(/^\d{4}-\d{2}-01$/, "month must be YYYY-MM-01");

export async function GET(req: Request) {
  let userId: string;
  try {
    userId = await requireUserId();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const monthParam = new URL(req.url).searchParams.get("month");
  const parsed = monthSchema.safeParse(monthParam);
  if (!parsed.success) {
    return NextResponse.json({ error: "Query param 'month' must be YYYY-MM-01" }, { status: 400 });
  }

  const budgets = await getBudgetsForMonth(userId, parsed.data);
  return NextResponse.json({ month: parsed.data, budgets });
}

const putSchema = z.object({
  month: monthSchema,
  categoryId: z.string().uuid(),
  amount: z.number().int().min(0),
  rolloverEnabled: z.boolean().default(false),
});

export async function PUT(req: Request) {
  let userId: string;
  try {
    userId = await requireUserId();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = putSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request", issues: parsed.error.issues }, { status: 400 });
  }
  const { month, categoryId, amount, rolloverEnabled } = parsed.data;

  const [budget] = await db
    .insert(schema.budgets)
    .values({ userId, month, categoryId, amount, rolloverEnabled })
    .onConflictDoUpdate({
      target: [schema.budgets.userId, schema.budgets.month, schema.budgets.categoryId],
      set: { amount, rolloverEnabled },
    })
    .returning();

  return NextResponse.json({ budget });
}

const deleteSchema = z.object({ month: monthSchema, categoryId: z.string().uuid() });

export async function DELETE(req: Request) {
  let userId: string;
  try {
    userId = await requireUserId();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = deleteSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request", issues: parsed.error.issues }, { status: 400 });
  }
  const { month, categoryId } = parsed.data;

  await db
    .delete(schema.budgets)
    .where(and(eq(schema.budgets.userId, userId), eq(schema.budgets.month, month), eq(schema.budgets.categoryId, categoryId)));

  return NextResponse.json({ ok: true });
}
