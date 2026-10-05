import { NextResponse } from "next/server";
import { and, desc, eq, isNotNull, isNull } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireUserId } from "@/lib/session";

export async function GET(req: Request) {
  let userId: string;
  try {
    userId = await requireUserId(req);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ?dismissed=1 lists the streams the user dismissed, newest first, for the
  // app's "Dismissed" group (each row carries dismissedAt either way).
  const dismissed = new URL(req.url).searchParams.get("dismissed") === "1";
  const streams = await db
    .select()
    .from(schema.recurringStreams)
    .where(
      and(
        eq(schema.recurringStreams.userId, userId),
        dismissed ? isNotNull(schema.recurringStreams.dismissedAt) : isNull(schema.recurringStreams.dismissedAt),
      ),
    )
    .orderBy(dismissed ? desc(schema.recurringStreams.dismissedAt) : desc(schema.recurringStreams.averageAmount));

  return NextResponse.json({ streams });
}
