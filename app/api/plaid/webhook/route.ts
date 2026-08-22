import { NextResponse } from "next/server";
import { db, schema } from "@/db";
import { eq } from "drizzle-orm";
import { verifyPlaidWebhook } from "@/lib/plaidWebhook";
import {
  enqueueSyncTransactions,
  enqueueSyncHoldings,
  enqueueSyncInvestmentTransactions,
  enqueueSyncLiabilities,
  type ItemSyncJobData,
} from "@/lib/queue";

const TRANSACTIONS_CODES = new Set(["SYNC_UPDATES_AVAILABLE", "INITIAL_UPDATE", "HISTORICAL_UPDATE", "DEFAULT_UPDATE"]);
const HOLDINGS_CODES = new Set(["DEFAULT_UPDATE"]);
const INVESTMENTS_TRANSACTIONS_CODES = new Set(["DEFAULT_UPDATE", "HISTORICAL_UPDATE"]);
const LIABILITIES_CODES = new Set(["DEFAULT_UPDATE"]);

// (webhook_type -> matching codes -> which queue to enqueue into), per §6.7's table.
const ENQUEUE_BY_TYPE: { type: string; codes: Set<string>; enqueue: (data: ItemSyncJobData) => Promise<unknown> }[] = [
  { type: "TRANSACTIONS", codes: TRANSACTIONS_CODES, enqueue: enqueueSyncTransactions },
  { type: "HOLDINGS", codes: HOLDINGS_CODES, enqueue: enqueueSyncHoldings },
  { type: "INVESTMENTS_TRANSACTIONS", codes: INVESTMENTS_TRANSACTIONS_CODES, enqueue: enqueueSyncInvestmentTransactions },
  { type: "LIABILITIES", codes: LIABILITIES_CODES, enqueue: enqueueSyncLiabilities },
];

// Public endpoint — no session. Trust nothing until the signature verifies.
// Every sync is handed off to the pg-boss queue (worker/index.ts) so a slow
// Plaid response can't hold the webhook connection open or block a retry
// storm.
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

  let queued = false;
  const match = ENQUEUE_BY_TYPE.find((m) => m.type === payload.webhook_type && m.codes.has(payload.webhook_code));
  if (match && payload.item_id) {
    const [item] = await db
      .select({ id: schema.plaidItems.id })
      .from(schema.plaidItems)
      .where(eq(schema.plaidItems.plaidItemId, payload.item_id))
      .limit(1);
    if (item) {
      try {
        await match.enqueue({ itemId: item.id, trigger: "webhook", webhookEventId: event?.id });
        queued = true;
      } catch (err) {
        console.error(`Failed to enqueue ${payload.webhook_type} sync for item ${item.id}`, err);
      }
    }
  }

  // A job was handed off — the worker updates this event's status when it
  // finishes. Everything else (ITEM status changes above) was handled
  // synchronously, so mark it processed now.
  if (!queued && event) {
    await db
      .update(schema.webhookEvents)
      .set({ status: "processed", processedAt: new Date() })
      .where(eq(schema.webhookEvents.id, event.id));
  }

  return NextResponse.json({ received: true });
}
