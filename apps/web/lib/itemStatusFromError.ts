import { and, eq, ne } from "drizzle-orm";
import { db, schema } from "@/db";
import { plaidErrorCode } from "@/lib/plaid";
import { evaluateConnections } from "@/lib/alerts/evaluate";

/**
 * Plaid error codes that mean the connection itself is broken until the user
 * acts -- the same states the ITEM webhook sets (app/api/plaid/webhook). Only
 * these: a transient bank/Plaid outage (INSTITUTION_DOWN, PRODUCT_NOT_READY…)
 * clears on the next sync and shouldn't flip the card.
 */
const STATUS_BY_CODE: Record<string, "login_required" | "revoked"> = {
  ITEM_LOGIN_REQUIRED: "login_required",
  USER_PERMISSION_REVOKED: "revoked",
  ACCESS_NOT_GRANTED: "revoked",
};

/**
 * A sync or balance refresh that Plaid rejects with a sign-in error marks the
 * item the way the webhook would. Before this only the webhook did, so a bank
 * whose ERROR webhook never arrived (or arrived late) stayed "healthy": no
 * "needs you" banner on Overview/Accounts, just silently stale numbers.
 * Never throws -- the caller is already handling the original error.
 */
export async function markItemFromPlaidError(itemId: string, err: unknown): Promise<void> {
  const code = plaidErrorCode(err);
  const status = code ? STATUS_BY_CODE[code] : undefined;
  if (!status) return;
  try {
    const [updated] = await db
      .update(schema.plaidItems)
      .set({ status, lastErrorCode: code })
      .where(and(eq(schema.plaidItems.id, itemId), ne(schema.plaidItems.status, status)))
      .returning({ userId: schema.plaidItems.userId });
    if (updated) await evaluateConnections(updated.userId);
  } catch (e) {
    console.error(`Couldn't record ${code} on item ${itemId}`, e);
  }
}
