import { and, eq, gte, isNull, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import type { AlertCandidate } from "@tally/core/alerts";
import { sendEmail } from "@/lib/emailService";
import { loadAlertPreferences, type AlertPreferences } from "@/lib/alerts/preferences";
import { alertEmailHtml, alertEmailSubject } from "@/lib/alerts/email";

type EventRow = typeof schema.alertEvents.$inferSelect;
interface StoredPayload {
  suppressed?: boolean;
  emailError?: string;
  [k: string]: unknown;
}

/**
 * Claims each candidate's dedupe key and delivers the ones that are new
 * (ALERTS.md §4.1). The unique (user_id, dedupe_key) insert is the lock: a
 * re-sync, retry or second webhook computes the same key, inserts nothing,
 * and sends nothing.
 *
 * Delivery is email only (push was dropped: no iOS push without an Apple
 * Developer account). Recorded but not sent ("suppressed"): everything in
 * the user's first evaluation (so turning alerts on doesn't replay every
 * budget already past 80%), silent candidates, and types with email off (so
 * turning a type on later doesn't replay old events).
 */
export async function recordAndDeliver(userId: string, candidates: AlertCandidate[], prefsIn?: AlertPreferences): Promise<number> {
  if (candidates.length === 0) return 0;
  const prefs = prefsIn ?? (await loadAlertPreferences(userId)).prefs;
  // "First evaluation" = no real alert recorded yet. Not "preferences row
  // just created": opening Settings creates that row before any sync runs.
  // Rows from the removed test-send feature (payload.test) don't count.
  const seeding = !(await hasRecordedAlerts(userId));
  const now = new Date();
  let delivered = 0;

  for (const c of candidates) {
    const ch = prefs.channels[c.type];
    const suppressed = seeding || !!c.silent || !ch.email;
    const [row] = await db
      .insert(schema.alertEvents)
      .values({
        userId,
        type: c.type,
        dedupeKey: c.dedupeKey,
        title: c.title,
        body: c.body,
        url: c.url,
        payload: { ...c.payload, suppressed } satisfies StoredPayload,
        deliverAfter: now,
      })
      .onConflictDoNothing({ target: [schema.alertEvents.userId, schema.alertEvents.dedupeKey] })
      .returning();
    if (!row || suppressed) continue;
    if (await deliver(row, prefs)) delivered++;
  }
  return delivered;
}

async function hasRecordedAlerts(userId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: schema.alertEvents.id })
    .from(schema.alertEvents)
    .where(and(eq(schema.alertEvents.userId, userId), sql`coalesce((${schema.alertEvents.payload}->>'test')::boolean, false) = false`))
    .limit(1);
  return !!row;
}

/**
 * Merges delivery status into the event's payload (no column needed): the
 * email error until a retry succeeds. Read back by lib/alerts/history.ts.
 */
async function noteDelivery(id: string, set: Record<string, unknown>, clear: string[] = []): Promise<void> {
  let expr = sql`coalesce(${schema.alertEvents.payload}, '{}'::jsonb) || ${JSON.stringify(set)}::jsonb`;
  for (const key of clear) expr = sql`(${expr}) - ${key}`;
  await db.update(schema.alertEvents).set({ payload: expr }).where(eq(schema.alertEvents.id, id));
}

/** Emails this event if email is on for its type and it hasn't gone out yet. Never throws. */
async function deliver(row: EventRow, prefs: AlertPreferences): Promise<boolean> {
  const payload = (row.payload ?? {}) as StoredPayload;
  if (!prefs.channels[row.type].email || row.emailSentAt) return false;
  try {
    const appUrl = process.env.APP_URL;
    const [user] = await db.select({ email: schema.users.email }).from(schema.users).where(eq(schema.users.id, row.userId)).limit(1);
    if (!appUrl || !user) throw new Error("APP_URL or user email missing");
    await sendEmail({
      to: user.email,
      subject: alertEmailSubject(row.title),
      html: alertEmailHtml({
        type: row.type,
        title: row.title,
        body: row.body,
        url: row.url ?? "/overview",
        appUrl,
        userId: row.userId,
      }),
    });
    await db.update(schema.alertEvents).set({ emailSentAt: new Date() }).where(eq(schema.alertEvents.id, row.id));
    if (payload.emailError) await noteDelivery(row.id, {}, ["emailError"]);
    return true;
  } catch (err) {
    console.error(`Alert email failed (event ${row.id})`, err);
    await noteDelivery(row.id, { emailError: err instanceof Error ? err.message : String(err) }).catch(() => {});
    return false;
  }
}

const RETRY_WINDOW_MS = 36 * 60 * 60 * 1000;

/**
 * Retries alert emails that failed in the last 36 hours (daily cron).
 * Older failures are dropped: a day-old "you're at 80%" isn't worth sending.
 */
export async function flushPendingAlerts(): Promise<number> {
  const now = new Date();
  const rows = await db
    .select()
    .from(schema.alertEvents)
    .where(
      and(gte(schema.alertEvents.createdAt, new Date(now.getTime() - RETRY_WINDOW_MS)), isNull(schema.alertEvents.emailSentAt)),
    );
  let delivered = 0;
  const prefsCache = new Map<string, AlertPreferences>();
  for (const row of rows) {
    const p = row.payload as StoredPayload | null;
    // payload.test: rows from the removed test-send feature; never retried.
    // scripts/delete-test-alerts.ts clears them out.
    if (p?.suppressed || p?.test) continue;
    let prefs = prefsCache.get(row.userId);
    if (!prefs) {
      prefs = (await loadAlertPreferences(row.userId)).prefs;
      prefsCache.set(row.userId, prefs);
    }
    if (await deliver(row, prefs)) delivered++;
  }
  return delivered;
}
