import { notInArray } from "drizzle-orm";
import { db, schema } from "@/db";

// Items in these states need re-auth before another sync attempt is useful
// (§6.8) — cron safety nets skip them rather than retrying pointlessly.
const SYNC_BLOCKED_STATUSES = ["login_required", "revoked"] as const;

export async function activeItems(): Promise<{ id: string; userId: string }[]> {
  return db
    .select({ id: schema.plaidItems.id, userId: schema.plaidItems.userId })
    .from(schema.plaidItems)
    .where(notInArray(schema.plaidItems.status, [...SYNC_BLOCKED_STATUSES]));
}

export async function activeItemIds(): Promise<string[]> {
  return (await activeItems()).map((i) => i.id);
}
