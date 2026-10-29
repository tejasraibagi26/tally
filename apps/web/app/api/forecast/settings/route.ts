import { NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireUserId } from "@/lib/session";
import { FORECAST_RANGES } from "@tally/core/forecast";

const bodySchema = z.object({
  // "Spend about $X a day", in cents; null goes back to the weekday median.
  dailySpendCents: z.number().int().min(0).max(1_000_000).nullable().optional(),
  // The horizon the user picked.
  days: z.union([z.literal(FORECAST_RANGES[0]), z.literal(FORECAST_RANGES[1]), z.literal(FORECAST_RANGES[2])]).optional(),
});

/** Forecast's two remembered choices: the daily-spend override and the range. */
export async function PATCH(req: Request) {
  let userId: string;
  try {
    userId = await requireUserId(req);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request", issues: parsed.error.issues }, { status: 400 });

  const { dailySpendCents, days } = parsed.data;
  const set: Partial<typeof schema.users.$inferInsert> = {};
  if (dailySpendCents !== undefined) set.forecastDailySpendCents = dailySpendCents;
  if (days !== undefined) set.forecastDays = days;
  if (Object.keys(set).length) await db.update(schema.users).set(set).where(eq(schema.users.id, userId));

  return NextResponse.json({ ok: true });
}
