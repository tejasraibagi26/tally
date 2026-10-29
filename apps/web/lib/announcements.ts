import { eq, sql } from "drizzle-orm";
import { db, schema } from "@/db";

/**
 * One-time announcements (modals shown once per account), recorded in
 * users.seen_announcements by key so a new one needs no migration. The
 * year-end goals intro predates this and keeps its own column
 * (users.goals_intro_seen_at, lib/goals.ts).
 */
export const ANNOUNCEMENTS = ["new-look", "forecast"] as const;
export type AnnouncementKey = (typeof ANNOUNCEMENTS)[number];

export async function seenAnnouncements(userId: string): Promise<string[]> {
  const [row] = await db.select({ seen: schema.users.seenAnnouncements }).from(schema.users).where(eq(schema.users.id, userId)).limit(1);
  return row?.seen ?? [];
}

/** Records a dismissal; a second call for the same key changes nothing. */
export async function markAnnouncementSeen(userId: string, key: AnnouncementKey): Promise<void> {
  await db
    .update(schema.users)
    .set({ seenAnnouncements: sql`array_append(${schema.users.seenAnnouncements}, ${key})` })
    .where(sql`${schema.users.id} = ${userId} and not (${key} = any(${schema.users.seenAnnouncements}))`);
}
