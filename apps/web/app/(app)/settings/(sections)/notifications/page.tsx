import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireUserId } from "@/lib/session";
import { AlertSettings } from "@/components/settings/AlertSettings";
import { loadAlertPreferences } from "@/lib/alerts/preferences";
import { alertHistory } from "@/lib/alerts/history";

// Settings → Notifications: the alerts, their history, and the monthly recap.
export default async function NotificationSettingsPage() {
  const userId = await requireUserId();
  const [[user], { prefs }, history] = await Promise.all([
    db.select({ recapsEnabled: schema.users.recapsEnabled }).from(schema.users).where(eq(schema.users.id, userId)).limit(1),
    loadAlertPreferences(userId),
    alertHistory(userId, 10),
  ]);
  return <AlertSettings initial={prefs} history={history} recapsEnabled={user?.recapsEnabled ?? true} />;
}
