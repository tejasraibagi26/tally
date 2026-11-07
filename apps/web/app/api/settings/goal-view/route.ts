import { route } from "@/lib/log";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUserId } from "@/lib/session";
import { setGoalView } from "@/lib/goalView";

const bodySchema = z.object({ enabled: z.boolean() });

// A display preference, like the recaps toggle: one click, no password. The
// caller reloads afterwards, because the opt-in is read server-side on
// /overview, /budgets and in the root layout's data-skin attribute.
async function PATCH_handler(req: Request) {
  let userId: string;
  try {
    userId = await requireUserId(req);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  await setGoalView(userId, parsed.data.enabled);
  return NextResponse.json({ ok: true });
}

export const PATCH = route(PATCH_handler);
