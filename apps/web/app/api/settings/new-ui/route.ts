import { route } from "@/lib/log";
import { NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireUserId } from "@/lib/session";

const bodySchema = z.object({ enabled: z.boolean() });

// Opt in to (or out of) the new Tally. One click, no password: it only
// changes which screens the user lands on (lib/newUi.ts).
async function PUT_handler(req: Request) {
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

  await db.update(schema.users).set({ newUiAt: parsed.data.enabled ? new Date() : null }).where(eq(schema.users.id, userId));
  return NextResponse.json({ ok: true, enabled: parsed.data.enabled });
}

export const PUT = route(PUT_handler);
