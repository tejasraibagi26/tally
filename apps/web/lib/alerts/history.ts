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
  /** null when that channel wasn't used for this alert. */
  email: { status: "sent" | "failed"; error?: string } | null;
  push: { status: "sent" | "no_device" | "failed" | "scheduled"; error?: string; devices?: number; at?: string } | null;
}

interface Payload {
  emailError?: string;
  pushError?: string;
  pushDevices?: number;
}

/** Delivered alerts, newest first. Suppressed rows (seeded, silent, channels off) are bookkeeping, not history. */
export async function alertHistory(userId: string, limit = 20): Promise<AlertHistoryItem[]> {
  const rows = await db
    .select()
    .from(schema.alertEvents)
    .where(and(eq(schema.alertEvents.userId, userId), sql`coalesce((${schema.alertEvents.payload}->>'suppressed')::boolean, false) = false`))
    .orderBy(desc(schema.alertEvents.createdAt))
    .limit(Math.min(Math.max(limit, 1), 50));
  const now = Date.now();
  return rows.map((r) => {
    const p = (r.payload ?? {}) as Payload;
    const email: AlertHistoryItem["email"] = r.emailSentAt
      ? { status: "sent" }
      : p.emailError
        ? { status: "failed", error: p.emailError }
        : null;
    const push: AlertHistoryItem["push"] = r.pushSentAt
      ? // Rows from before pushDevices was recorded: no phone had registered yet.
        (p.pushDevices ?? 0) > 0
        ? { status: "sent", devices: p.pushDevices }
        : { status: "no_device" }
      : p.pushError
        ? { status: "failed", error: p.pushError }
        : r.deliverAfter.getTime() > now
          ? { status: "scheduled", at: r.deliverAfter.toISOString() }
          : null;
    return {
      id: r.id,
      type: r.type,
      title: r.title,
      body: r.body,
      url: r.url,
      createdAt: r.createdAt.toISOString(),
      read: !!r.readAt,
      email,
      push,
    };
  });
}

export async function pushDeviceCount(userId: string): Promise<number> {
  const [row] = await db.select({ n: sql<number>`count(*)::int` }).from(schema.pushTokens).where(eq(schema.pushTokens.userId, userId));
  return row?.n ?? 0;
}
