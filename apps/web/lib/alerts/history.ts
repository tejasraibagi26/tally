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
  /** null when the email wasn't attempted (email off for this type). */
  email: { status: "sent" | "failed"; error?: string } | null;
}

interface Payload {
  emailError?: string;
}

/** Delivered alerts, newest first. Suppressed rows (seeded, silent, channels off) are bookkeeping, not history. */
export async function alertHistory(userId: string, limit = 20): Promise<AlertHistoryItem[]> {
  const rows = await db
    .select()
    .from(schema.alertEvents)
    .where(and(eq(schema.alertEvents.userId, userId), sql`coalesce((${schema.alertEvents.payload}->>'suppressed')::boolean, false) = false`))
    .orderBy(desc(schema.alertEvents.createdAt))
    .limit(Math.min(Math.max(limit, 1), 50));
  return rows.map((r) => {
    const p = (r.payload ?? {}) as Payload;
    const email: AlertHistoryItem["email"] = r.emailSentAt
      ? { status: "sent" }
      : p.emailError
        ? { status: "failed", error: p.emailError }
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
    };
  });
}
