import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import type { AlertType } from "@tally/core/alerts";

/** Email is the only channel: push was dropped (no iOS push without an Apple Developer account). */
export type Channels = { email: boolean };

export const DEFAULT_CHANNELS: Record<AlertType, Channels> = {
  budget_threshold: { email: true },
  connection_broken: { email: true },
  large_transaction: { email: true },
  subscription_change: { email: true },
};

export const ALERT_TYPES = Object.keys(DEFAULT_CHANNELS) as AlertType[];

export interface AlertPreferences {
  channels: Record<AlertType, Channels>;
  largeTransactionCents: number;
}

/**
 * The user's alert settings, creating the row with defaults on first read.
 * (The engine's no-backlog seeding keys off alert_events, not `created`.)
 */
export async function loadAlertPreferences(userId: string): Promise<{ prefs: AlertPreferences; created: boolean }> {
  const [row] = await db.select().from(schema.alertPreferences).where(eq(schema.alertPreferences.userId, userId)).limit(1);
  if (row) {
    return {
      prefs: {
        channels: Object.fromEntries(
          ALERT_TYPES.map((t) => [t, { email: row.channels[t]?.email ?? DEFAULT_CHANNELS[t].email }]),
        ) as Record<AlertType, Channels>,
        largeTransactionCents: row.largeTransactionCents,
      },
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
  return { prefs: { channels: DEFAULT_CHANNELS, largeTransactionCents: 50_000 }, created: true };
}
