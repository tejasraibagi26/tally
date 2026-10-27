import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUserId } from "@/lib/session";
import { archiveGoal, goalSummary, goalsIntroSeen, markGoalsIntroSeen, saveGoal } from "@/lib/goals";

/**
 * The year-end goal (lib/goals.ts): one per user, so one resource.
 * GET → { goal, projection, cuts } or { goal: null }, plus introSeen (the
 * one-time announcement, POST /api/goals/intro); PUT sets or changes it;
 * DELETE removes it. Web and mobile (bearer token) both use it; only the
 * Tally Pop UI links to it.
 */
async function user(req: Request): Promise<string | null> {
  try {
    return await requireUserId(req);
  } catch {
    return null;
  }
}

export async function GET(req: Request) {
  const userId = await user(req);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const [summary, introSeen] = await Promise.all([goalSummary(userId), goalsIntroSeen(userId)]);
  return NextResponse.json({ ...(summary ?? { goal: null }), introSeen });
}

const bodySchema = z.object({
  targetCents: z.number().int().positive().max(1_000_000_000_00),
  deadline: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export async function PUT(req: Request) {
  const userId = await user(req);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  await saveGoal(userId, parsed.data);
  // Setting one counts as seeing the announcement (from any screen).
  await markGoalsIntroSeen(userId);
  return NextResponse.json(await goalSummary(userId));
}

export async function DELETE(req: Request) {
  const userId = await user(req);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await archiveGoal(userId);
  return NextResponse.json({ ok: true });
}
