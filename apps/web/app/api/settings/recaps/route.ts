import { NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireUserId } from "@/lib/session";

const bodySchema = z.object({ enabled: z.boolean() });

// Not bundled into PATCH /api/account (name/email/birthDate, password-gated) —
// this toggle is non-sensitive and should be a single click, no password.
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

  await db.update(schema.users).set({ recapsEnabled: parsed.data.enabled }).where(eq(schema.users.id, userId));
  return NextResponse.json({ ok: true });
}
