import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireUserId } from "@/lib/session";
import { DangerZone } from "@/components/settings/DangerZone";

// Settings → Danger zone. Every action in it confirms first.
export default async function DangerSettingsPage() {
  const userId = await requireUserId();
  const items = await db.select({ id: schema.plaidItems.id }).from(schema.plaidItems).where(eq(schema.plaidItems.userId, userId));
  return <DangerZone itemCount={items.length} />;
}
