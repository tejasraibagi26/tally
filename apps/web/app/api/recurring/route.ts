import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireUserId } from "@/lib/session";

export async function GET(req: Request) {
  let userId: string;
  try {
    userId = await requireUserId(req);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const streams = await db
    .select()
    .from(schema.recurringStreams)
    .where(eq(schema.recurringStreams.userId, userId))
    .orderBy(desc(schema.recurringStreams.averageAmount));

  return NextResponse.json({ streams });
}
