import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUserId } from "@/lib/session";
import { updateFlaggedUiLook } from "@/lib/uiLook";

const bodySchema = z.object({ look: z.enum(["pop", "classic"]) });

// The "New look" switch (components/UiToggle.tsx) saving its choice so
// emails follow it. Only changes an already-flagged user; flagging stays
// link-only (/labs/pop).
export async function PATCH(req: Request) {
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

  await updateFlaggedUiLook(userId, parsed.data.look);
  return NextResponse.json({ ok: true });
}
