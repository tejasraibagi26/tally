import { and, desc, eq, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import type { AlertType } from "@tally/core/alerts";

export interface AlertHistoryItem {
  id: string;
  type: AlertType;
  title: string;
  body: string;
  url: string | null;
  createdAt: string;
  read: boolean;
  test: boolean;
  /** Which channels it actually went out on. */
  push: boolean;
  email: boolean;
}

/** Delivered alerts, newest first. Suppressed rows (seeded, silent, channels off) are bookkeeping, not history. */
export async function alertHistory(userId: string, limit = 20): Promise<AlertHistoryItem[]> {
  const rows = await db
    .select()
    .from(schema.alertEvents)
    .where(and(eq(schema.alertEvents.userId, userId), sql`coalesce((${schema.alertEvents.payload}->>'suppressed')::boolean, false) = false`))
    .orderBy(desc(schema.alertEvents.createdAt))
    .limit(Math.min(Math.max(limit, 1), 50));
  return rows.map((r) => ({
    id: r.id,
    type: r.type,
    title: r.title,
    body: r.body,
    url: r.url,
    createdAt: r.createdAt.toISOString(),
    read: !!r.readAt,
    test: !!(r.payload as { test?: boolean } | null)?.test,
    push: !!r.pushSentAt,
    email: !!r.emailSentAt,
  }));
}

export async function pushDeviceCount(userId: string): Promise<number> {
  const [row] = await db.select({ n: sql<number>`count(*)::int` }).from(schema.pushTokens).where(eq(schema.pushTokens.userId, userId));
  return row?.n ?? 0;
}
