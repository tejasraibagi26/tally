import { and, eq, isNotNull } from "drizzle-orm";
import { db, schema } from "@/db";
import { UI_POP } from "@/lib/uiFlag";

/**
 * The server-side copy of the Tally Pop flag (users.ui_look): null when the
 * user isn't flagged, otherwise "pop" or "classic". The browser cookie
 * (lib/uiFlag.ts) drives the web UI; this drives what can't read cookies --
 * which template an email uses.
 */
export type UiLook = "pop" | "classic";

/** Flags the user (look) or unflags them (null). Only /labs/pop calls this. */
export async function setUserUiLook(userId: string, look: UiLook | null): Promise<void> {
  await db.update(schema.users).set({ uiLook: look }).where(eq(schema.users.id, userId));
}

/** The "New look" switch: changes a flagged user's choice, never flags anyone. */
export async function updateFlaggedUiLook(userId: string, look: UiLook): Promise<void> {
  await db
    .update(schema.users)
    .set({ uiLook: look })
    .where(and(eq(schema.users.id, userId), isNotNull(schema.users.uiLook)));
}

/** Whether this user's emails use the Tally Pop templates. */
export function wantsPopEmail(user: { uiLook: string | null }): boolean {
  return user.uiLook === UI_POP;
}
