import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { UI_CLASSIC } from "@/lib/uiFlag";

/**
 * The account's look (users.ui_look): null = never chosen, which means
 * Tally Pop, the default since web v2.2.0; otherwise "pop" or "classic" as
 * the "New look" switch last set it. The browser cookie (lib/uiFlag.ts)
 * drives the web UI; this drives what can't read cookies -- which template
 * an email uses, and the mobile app.
 */
export type UiLook = "pop" | "classic";

/** Sets the account's look (/labs/pop and the switch). */
export async function setUserUiLook(userId: string, look: UiLook | null): Promise<void> {
  await db.update(schema.users).set({ uiLook: look }).where(eq(schema.users.id, userId));
}

/** Whether this user's emails use the Tally Pop templates: everyone but a classic opt-out. */
export function wantsPopEmail(user: { uiLook: string | null }): boolean {
  return user.uiLook !== UI_CLASSIC;
}
