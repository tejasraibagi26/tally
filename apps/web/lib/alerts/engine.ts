import { and, eq, gte, isNull, lte, or } from "drizzle-orm";
import { db, schema } from "@/db";
import { deliverAfter, type AlertCandidate } from "@tally/core/alerts";
import { sendEmail } from "@/lib/emailService";
import { getUserTimezone } from "@/lib/userTimezone";
import { loadAlertPreferences, type AlertPreferences } from "@/lib/alerts/preferences";
import { sendPushToUser } from "@/lib/alerts/push";
import { alertEmailHtml } from "@/lib/alerts/email";

type EventRow = typeof schema.alertEvents.$inferSelect;
interface StoredPayload {
  suppressed?: boolean;
  titleNoAmounts?: string;
  bodyNoAmounts?: string;
  [k: string]: unknown;
}

/**
 * Claims each candidate's dedupe key and delivers the ones that are new
 * (ALERTS.md §4.1). The unique (user_id, dedupe_key) insert is the lock: a
 * re-sync, retry or second webhook computes the same key, inserts nothing,
 * and sends nothing.
 *
 * Recorded but not delivered ("suppressed"): the user's first evaluation
 * (so turning alerts on doesn't replay every budget already past 80%),
 * silent candidates, and types with both channels off (so turning a type on
 * later doesn't replay old events).
 */
export async function recordAndDeliver(
  userId: string,
  candidates: AlertCandidate[],
  // Pass what the caller already loaded: loading twice would lose `created`
  // (the second read finds the row the first one made) and skip the seed.
  loaded?: { prefs: AlertPreferences; created: boolean },
): Promise<number> {
  if (candidates.length === 0) return 0;
  const { prefs, created } = loaded ?? (await loadAlertPreferences(userId));
  const timeZone = await getUserTimezone(userId);
  const now = new Date();
  let delivered = 0;

  for (const c of candidates) {
    const ch = prefs.channels[c.type];
    const suppressed = created || !!c.silent || (!ch.push && !ch.email);
    const [row] = await db
      .insert(schema.alertEvents)
      .values({
        userId,
        type: c.type,
        dedupeKey: c.dedupeKey,
        title: c.title,
        body: c.body,
        url: c.url,
        payload: { ...c.payload, suppressed, titleNoAmounts: c.titleNoAmounts, bodyNoAmounts: c.bodyNoAmounts } satisfies StoredPayload,
        deliverAfter: suppressed || !ch.push ? now : deliverAfter(now, timeZone),
      })
      .onConflictDoNothing({ target: [schema.alertEvents.userId, schema.alertEvents.dedupeKey] })
      .returning();
    if (!row || suppressed) continue;
    if (await deliver(row, prefs, now)) delivered++;
  }
  return delivered;
}

/** Sends whatever channels are on and still unsent for this event. Never throws. */
async function deliver(row: EventRow, prefs: AlertPreferences, now: Date): Promise<boolean> {
  const ch = prefs.channels[row.type];
  const payload = (row.payload ?? {}) as StoredPayload;
  let sent = false;

  if (ch.email && !row.emailSentAt) {
    try {
      const appUrl = process.env.APP_URL;
      const [user] = await db.select({ email: schema.users.email }).from(schema.users).where(eq(schema.users.id, row.userId)).limit(1);
      if (!appUrl || !user) throw new Error("APP_URL or user email missing");
      await sendEmail({
        to: user.email,
        subject: row.title,
        html: alertEmailHtml({ title: row.title, body: row.body, url: row.url ?? "/overview", appUrl, userId: row.userId }),
      });
      await db.update(schema.alertEvents).set({ emailSentAt: new Date() }).where(eq(schema.alertEvents.id, row.id));
      sent = true;
    } catch (err) {
      console.error(`Alert email failed (event ${row.id})`, err);
    }
  }

  if (ch.push && !row.pushSentAt && row.deliverAfter <= now) {
    try {
      const amounts = prefs.showAmounts;
      await sendPushToUser(row.userId, {
        title: amounts ? row.title : (payload.titleNoAmounts ?? row.title),
        body: amounts ? row.body : (payload.bodyNoAmounts ?? row.body),
        data: { url: row.url, alertId: row.id, transactionId: payload.transactionId ?? null },
      });
      // Marked sent even with no devices registered yet: a phone added later
      // shouldn't receive a backlog of old alerts.
      await db.update(schema.alertEvents).set({ pushSentAt: new Date() }).where(eq(schema.alertEvents.id, row.id));
      sent = true;
    } catch (err) {
      console.error(`Alert push failed (event ${row.id})`, err);
    }
  }
  return sent;
}

const RETRY_WINDOW_MS = 36 * 60 * 60 * 1000;

/**
 * Sends push held back by quiet hours and retries failed sends from the
 * last 36 hours (daily cron). Older failures are dropped: a day-old "you're
 * at 80%" isn't worth sending.
 */
export async function flushPendingAlerts(): Promise<number> {
  const now = new Date();
  const rows = await db
    .select()
    .from(schema.alertEvents)
    .where(
      and(
        lte(schema.alertEvents.deliverAfter, now),
        gte(schema.alertEvents.createdAt, new Date(now.getTime() - RETRY_WINDOW_MS)),
        or(isNull(schema.alertEvents.pushSentAt), isNull(schema.alertEvents.emailSentAt)),
      ),
    );
  let delivered = 0;
  const prefsCache = new Map<string, AlertPreferences>();
  for (const row of rows) {
    if ((row.payload as StoredPayload | null)?.suppressed) continue;
    let prefs = prefsCache.get(row.userId);
    if (!prefs) {
      prefs = (await loadAlertPreferences(row.userId)).prefs;
      prefsCache.set(row.userId, prefs);
    }
    if (await deliver(row, prefs, now)) delivered++;
  }
  return delivered;
}
