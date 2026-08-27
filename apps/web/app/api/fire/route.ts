import { NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireUserId } from "@/lib/session";

export async function GET(req: Request) {
  let userId: string;
  try {
    userId = await requireUserId(req);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [settings] = await db.select().from(schema.fireSettings).where(eq(schema.fireSettings.userId, userId)).limit(1);
  return NextResponse.json({ settings: settings ?? null });
}

const putSchema = z.object({
  swr: z.number().min(0.01).max(0.1),
  expectedReturn: z.number().min(-0.05).max(0.15),
  annualExpensesOverride: z.number().int().min(0).nullable(),
  monthlyContributionOverride: z.number().int().min(0).nullable(),
});

export async function PUT(req: Request) {
  let userId: string;
  try {
    userId = await requireUserId(req);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = putSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request", issues: parsed.error.issues }, { status: 400 });
  }
  const { swr, expectedReturn, annualExpensesOverride, monthlyContributionOverride } = parsed.data;

  const [settings] = await db
    .insert(schema.fireSettings)
    .values({
      userId,
      swr: swr.toString(),
      expectedReturn: expectedReturn.toString(),
      annualExpensesOverride,
      monthlyContributionOverride,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: schema.fireSettings.userId,
      set: { swr: swr.toString(), expectedReturn: expectedReturn.toString(), annualExpensesOverride, monthlyContributionOverride, updatedAt: new Date() },
    })
    .returning();

  return NextResponse.json({ settings });
}
