import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireUserId } from "@/lib/session";
import { ProfileSection } from "@/components/settings/ProfileSection";

// Settings → Account, at /settings itself (components/settings/sections.ts).
export default async function AccountSettingsPage() {
  const userId = await requireUserId();
  const [user] = await db
    .select({ name: schema.users.name, email: schema.users.email, birthDate: schema.users.birthDate })
    .from(schema.users)
    .where(eq(schema.users.id, userId))
    .limit(1);
  return <ProfileSection name={user?.name ?? ""} email={user?.email ?? ""} birthDate={user?.birthDate ?? null} />;
}
