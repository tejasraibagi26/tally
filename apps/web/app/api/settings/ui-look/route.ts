import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUserId } from "@/lib/session";
import { setUserUiLook } from "@/lib/uiLook";

const bodySchema = z.object({ look: z.enum(["pop", "classic"]) });

// The "New look" switch (web components/UiToggle.tsx, mobile Settings)
// saving the account's look, so emails and the other app follow it.
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

  await setUserUiLook(userId, parsed.data.look);
  return NextResponse.json({ ok: true });
}
