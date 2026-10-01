import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import type { AlertType } from "@tally/core/alerts";

export type Channels = { push: boolean; email: boolean };

/** ALERTS.md §2: everything pushes; only a broken connection also emails. */
export const DEFAULT_CHANNELS: Record<AlertType, Channels> = {
  budget_threshold: { push: true, email: false },
  connection_broken: { push: true, email: true },
  large_transaction: { push: true, email: false },
  subscription_change: { push: true, email: false },
};

export const ALERT_TYPES = Object.keys(DEFAULT_CHANNELS) as AlertType[];

export interface AlertPreferences {
  channels: Record<AlertType, Channels>;
  largeTransactionCents: number;
  showAmounts: boolean;
}

/**
 * The user's alert settings, creating the row with defaults on first read.
 * (The engine's no-backlog seeding keys off alert_events, not `created`.)
 */
export async function loadAlertPreferences(userId: string): Promise<{ prefs: AlertPreferences; created: boolean }> {
  const [row] = await db.select().from(schema.alertPreferences).where(eq(schema.alertPreferences.userId, userId)).limit(1);
  if (row) {
    return {
      prefs: { channels: { ...DEFAULT_CHANNELS, ...row.channels }, largeTransactionCents: row.largeTransactionCents, showAmounts: row.showAmounts },
      created: false,
    };
  }
  const inserted = await db
    .insert(schema.alertPreferences)
    .values({ userId, channels: DEFAULT_CHANNELS })
    .onConflictDoNothing()
    .returning({ userId: schema.alertPreferences.userId });
  // A concurrent first read lost the race: the other one seeds, this one reads.
  if (inserted.length === 0) return loadAlertPreferences(userId);
  return { prefs: { channels: DEFAULT_CHANNELS, largeTransactionCents: 50_000, showAmounts: true }, created: true };
}
