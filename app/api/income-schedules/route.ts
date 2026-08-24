import { NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireUserId } from "@/lib/session";
import { generateDuePaychecks } from "@/lib/incomeSchedule";

export async function GET() {
  let userId: string;
  try {
    userId = await requireUserId();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const schedules = await db
    .select({
      id: schema.incomeSchedules.id,
      accountId: schema.incomeSchedules.accountId,
      categoryId: schema.incomeSchedules.categoryId,
      label: schema.incomeSchedules.label,
      amount: schema.incomeSchedules.amount,
      dayAnchors: schema.incomeSchedules.dayAnchors,
      active: schema.incomeSchedules.active,
      accountName: schema.accounts.name,
      accountMask: schema.accounts.mask,
      categoryName: schema.categories.name,
    })
    .from(schema.incomeSchedules)
    .leftJoin(schema.accounts, eq(schema.incomeSchedules.accountId, schema.accounts.id))
    .leftJoin(schema.categories, eq(schema.incomeSchedules.categoryId, schema.categories.id))
    .where(eq(schema.incomeSchedules.userId, userId));

  return NextResponse.json({ schedules });
}

// Anchors: 1-31 (a day of month) or 0 ("last day of the month") — resolved
// per-month by lib/incomeScheduleMath.ts, which also handles the
// weekend-shift-to-Friday rule. 1-2 anchors covers semi-monthly and monthly;
// capped at 2 since that's all this feature is scoped for.
const anchorSchema = z.number().int().min(0).max(31);
const bodySchema = z.object({
  accountId: z.string().uuid(),
  categoryId: z.string().uuid().nullable().optional(),
  label: z.string().min(1).max(80).default("Paycheck"),
  amount: z.number().int().positive(),
  dayAnchors: z.array(anchorSchema).min(1).max(2),
});

export async function POST(req: Request) {
  let userId: string;
  try {
    userId = await requireUserId();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request", issues: parsed.error.issues }, { status: 400 });
  }
  const { accountId, categoryId, label, amount, dayAnchors } = parsed.data;

  const [account] = await db
    .select({ id: schema.accounts.id, userId: schema.accounts.userId })
    .from(schema.accounts)
    .where(eq(schema.accounts.id, accountId))
    .limit(1);
  if (!account || account.userId !== userId) {
    return NextResponse.json({ error: "Account not found" }, { status: 404 });
  }

  const [schedule] = await db
    .insert(schema.incomeSchedules)
    .values({ userId, accountId, categoryId: categoryId ?? null, label, amount, dayAnchors })
    .returning();
  if (!schedule) {
    return NextResponse.json({ error: "Failed to create schedule" }, { status: 500 });
  }

  // Immediately backfill this month's (and, in case this is set up a bit
  // late, last month's) already-passed payday(s) rather than waiting for the
  // next nightly cron — "do the math for the month" shouldn't require an
  // overnight delay.
  const today = new Date().toISOString().slice(0, 10);
  const generated = await generateDuePaychecks(schedule, today);

  return NextResponse.json({ schedule, generated });
}
