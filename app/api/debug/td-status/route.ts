import { NextResponse } from "next/server";
import { db, schema } from "@/db";
import { and, eq, ilike, desc } from "drizzle-orm";
import { requireUserId } from "@/lib/session";

/**
 * TEMPORARY diagnostic route — investigating why the TD Canada Trust item's
 * transactions never land (stuck NOT_READY at /transactions/sync). Remove
 * after use.
 */
export async function GET() {
  let userId: string;
  try {
    userId = await requireUserId();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const items = await db.query.plaidItems.findMany({
    where: and(eq(schema.plaidItems.userId, userId), ilike(schema.plaidItems.institutionName, "%TD%")),
  });

  const result = [];
  for (const item of items) {
    const accounts = await db.query.accounts.findMany({ where: eq(schema.accounts.itemId, item.id) });
    const accountsWithCounts = [];
    for (const a of accounts) {
      const count = await db.$count(schema.transactions, eq(schema.transactions.accountId, a.id));
      accountsWithCounts.push({ id: a.id, name: a.name, type: a.type, subtype: a.subtype, transactionCount: count });
    }

    const runs = await db.query.syncRuns.findMany({
      where: eq(schema.syncRuns.itemId, item.id),
      orderBy: [desc(schema.syncRuns.startedAt)],
      limit: 20,
    });

    const webhooks = await db.query.webhookEvents.findMany({
      where: eq(schema.webhookEvents.itemId, item.plaidItemId),
      orderBy: [desc(schema.webhookEvents.receivedAt)],
      limit: 20,
    });

    result.push({
      item: {
        id: item.id,
        plaidItemId: item.plaidItemId,
        institutionName: item.institutionName,
        institutionId: item.institutionId,
        status: item.status,
        lastErrorCode: item.lastErrorCode,
        consentedProducts: item.consentedProducts,
        availableProducts: item.availableProducts,
        hasTransactionsCursor: item.transactionsCursor != null,
        lastSyncedAt: item.lastSyncedAt,
        createdAt: item.createdAt,
      },
      accounts: accountsWithCounts,
      recentSyncRuns: runs,
      recentWebhookEvents: webhooks.map((w) => ({
        webhookType: w.webhookType,
        webhookCode: w.webhookCode,
        receivedAt: w.receivedAt,
        status: w.status,
        error: w.error,
      })),
    });
  }

  return NextResponse.json({ items: result });
}
