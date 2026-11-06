import { route } from "@/lib/log";
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireUserId } from "@/lib/session";

async function DELETE_handler(req: Request, { params }: { params: Promise<{ id: string }> }) {
  let userId: string;
  try {
    userId = await requireUserId(req);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const [existing] = await db
    .select({ id: schema.apiKeys.id, userId: schema.apiKeys.userId })
    .from(schema.apiKeys)
    .where(eq(schema.apiKeys.id, id))
    .limit(1);
  if (!existing || existing.userId !== userId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await db.delete(schema.apiKeys).where(eq(schema.apiKeys.id, id));

  return NextResponse.json({ ok: true });
}

export const DELETE = route(DELETE_handler);
