import { NextResponse } from "next/server";
import { db, schema } from "@/db";
import { eq, sql } from "drizzle-orm";
import { verifyPlaidWebhook } from "@/lib/plaidWebhook";
import { syncTransactionsForItem, type SyncTrigger } from "@/lib/plaidSync";
import { syncHoldingsForItem, syncInvestmentTransactionsForItem } from "@/lib/plaidInvestments";
import { syncLiabilitiesForItem } from "@/lib/plaidLiabilities";

export const maxDuration = 120;

const TRANSACTIONS_CODES = new Set(["SYNC_UPDATES_AVAILABLE", "INITIAL_UPDATE", "HISTORICAL_UPDATE", "DEFAULT_UPDATE"]);
const HOLDINGS_CODES = new Set(["DEFAULT_UPDATE"]);
const INVESTMENTS_TRANSACTIONS_CODES = new Set(["DEFAULT_UPDATE", "HISTORICAL_UPDATE"]);
const LIABILITIES_CODES = new Set(["DEFAULT_UPDATE"]);

// (webhook_type -> matching codes -> which sync function to run), per §6.7's table.
const SYNC_BY_TYPE: { type: string; codes: Set<string>; sync: (itemId: string, trigger: SyncTrigger) => Promise<unknown> }[] = [
  { type: "TRANSACTIONS", codes: TRANSACTIONS_CODES, sync: syncTransactionsForItem },
  { type: "HOLDINGS", codes: HOLDINGS_CODES, sync: syncHoldingsForItem },
  { type: "INVESTMENTS_TRANSACTIONS", codes: INVESTMENTS_TRANSACTIONS_CODES, sync: syncInvestmentTransactionsForItem },
  { type: "LIABILITIES", codes: LIABILITIES_CODES, sync: syncLiabilitiesForItem },
];

// Public endpoint — no session. Trust nothing until the signature verifies.
// Processed inline, synchronously, within the request — no queue/worker.
// Vercel Functions don't support a persistent listener process; a single
// item's sync normally takes a few seconds, well within the function's
// execution budget. The twice-daily/nightly cron routes (app/api/cron/*)
// remain the safety net if a webhook-triggered sync here fails — this
// endpoint always returns 200 regardless, matching that "webhook is the
// fast path, cron is the backstop" design rather than relying on Plaid's
// own webhook-delivery retries.
export async function POST(req: Request) {
  const rawBody = await req.text();
  const verified = await verifyPlaidWebhook(rawBody, req.headers.get("plaid-verification"));

  if (!verified) {
    return NextResponse.json({ error: "Signature verification failed" }, { status: 400 });
  }

  const payload = JSON.parse(rawBody) as {
    webhook_type: string;
    webhook_code: string;
    item_id?: string;
    error?: { error_code?: string } | null;
  };

  const [event] = await db
    .insert(schema.webhookEvents)
    .values({
      provider: "plaid",
      itemId: payload.item_id ?? null,
      webhookType: payload.webhook_type,
      webhookCode: payload.webhook_code,
      payload,
      signatureVerified: true,
    })
    .returning({ id: schema.webhookEvents.id });

  if (payload.webhook_type === "ITEM" && payload.item_id) {
    const status =
      payload.webhook_code === "ERROR" && payload.error?.error_code === "ITEM_LOGIN_REQUIRED"
        ? "login_required"
        : payload.webhook_code === "PENDING_EXPIRATION" || payload.webhook_code === "PENDING_DISCONNECT"
          ? "pending_expiration"
          : payload.webhook_code === "USER_PERMISSION_REVOKED"
            ? "revoked"
            : payload.webhook_code === "ERROR"
              ? "error"
              : null;

    if (status) {
      await db
        .update(schema.plaidItems)
        .set({ status, lastErrorCode: payload.error?.error_code ?? null })
        .where(eq(schema.plaidItems.plaidItemId, payload.item_id));
    }
  }

  let processed = false;
  const match = SYNC_BY_TYPE.find((m) => m.type === payload.webhook_type && m.codes.has(payload.webhook_code));
  if (match && payload.item_id) {
    const [item] = await db
      .select({ id: schema.plaidItems.id })
      .from(schema.plaidItems)
      .where(eq(schema.plaidItems.plaidItemId, payload.item_id))
      .limit(1);
    if (item) {
      try {
        await match.sync(item.id, "webhook");
        if (event) {
          await db
            .update(schema.webhookEvents)
            .set({ status: "processed", processedAt: new Date() })
            .where(eq(schema.webhookEvents.id, event.id));
        }
        processed = true;
      } catch (err) {
        console.error(`Webhook-triggered ${payload.webhook_type} sync failed for item ${item.id}`, err);
        if (event) {
          await db
            .update(schema.webhookEvents)
            .set({
              status: "failed",
              error: err instanceof Error ? err.message : "unknown error",
              attempts: sql`${schema.webhookEvents.attempts} + 1`,
            })
            .where(eq(schema.webhookEvents.id, event.id));
        }
      }
    }
  }

  // Nothing matched a syncable product (e.g. a bare ITEM status webhook) —
  // that was handled synchronously above, so mark it processed now.
  if (!processed && event) {
    await db
      .update(schema.webhookEvents)
      .set({ status: "processed", processedAt: new Date() })
      .where(eq(schema.webhookEvents.id, event.id));
  }

  return NextResponse.json({ received: true });
}
