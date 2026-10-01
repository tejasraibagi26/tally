import { NextResponse } from "next/server";
import { and, eq, isNull } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireUserId } from "@/lib/session";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  let userId: string;
  try {
    userId = await requireUserId(req);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  await db
    .update(schema.alertEvents)
    .set({ readAt: new Date() })
    .where(and(eq(schema.alertEvents.id, id), eq(schema.alertEvents.userId, userId), isNull(schema.alertEvents.readAt)));
  return NextResponse.json({ ok: true });
}
