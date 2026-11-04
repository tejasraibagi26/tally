import { and, eq, ne, notInArray } from "drizzle-orm";
import { db, schema } from "@/db";
import { plaidErrorCode } from "@/lib/plaid";
import { evaluateConnections } from "@/lib/alerts/evaluate";

/**
 * Plaid error codes that mean the connection itself is broken until the user
 * acts -- the same states the ITEM webhook sets (app/api/plaid/webhook).
 */
const BLOCKED_BY_CODE: Record<string, "login_required" | "revoked"> = {
  ITEM_LOGIN_REQUIRED: "login_required",
  USER_PERMISSION_REVOKED: "revoked",
  ACCESS_NOT_GRANTED: "revoked",
};

/**
 * Plaid's or the bank's side failing. Status "error" gives the card its
 * "isn't responding" notice with Retry (sign in again after a day), and the
 * next successful sync sets it back to healthy. PRODUCT_NOT_READY is left
 * out on purpose: that's a bank still preparing data (the TD case), not down.
 */
const OUTAGE_CODES = new Set([
  "INTERNAL_SERVER_ERROR",
  "INSTITUTION_DOWN",
  "INSTITUTION_NOT_RESPONDING",
  "INSTITUTION_NOT_AVAILABLE",
  "PLANNED_MAINTENANCE",
]);

/**
 * A sync or balance refresh that Plaid rejects marks the item the way the
 * webhook would. Before this only the webhook did, so a bank
 * whose ERROR webhook never arrived (or arrived late) stayed "healthy": no
 * "needs you" banner on Overview/Accounts, just silently stale numbers.
 * Never throws -- the caller is already handling the original error.
 */
export async function markItemFromPlaidError(itemId: string, err: unknown): Promise<void> {
  const code = plaidErrorCode(err);
  if (!code) return;
  const status = BLOCKED_BY_CODE[code] ?? (OUTAGE_CODES.has(code) ? "error" : undefined);
  if (!status) return;
  try {
    const [updated] = await db
      .update(schema.plaidItems)
      .set({ status, lastErrorCode: code })
      .where(
        and(
          eq(schema.plaidItems.id, itemId),
          ne(schema.plaidItems.status, status),
          // An outage never softens a signed-out or revoked bank to "error".
          status === "error" ? notInArray(schema.plaidItems.status, ["login_required", "revoked"]) : undefined,
        ),
      )
      .returning({ userId: schema.plaidItems.userId });
    // An outage may clear on the next try, so it doesn't email right away;
    // the daily sweep alerts if it's still down. Signed-out alerts now.
    if (updated && status !== "error") await evaluateConnections(updated.userId);
  } catch (e) {
    console.error(`Couldn't record ${code} on item ${itemId}`, e);
  }
}
