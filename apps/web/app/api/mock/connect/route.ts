import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { db, schema } from "@/db";
import { eq } from "drizzle-orm";
import { requireUserId } from "@/lib/session";
import { MOCK_MODE } from "@/lib/config";
import { MOCK_INSTITUTIONS } from "@/lib/mock/fixtures";
import { syncTransactionsForItem } from "@/lib/plaidSync";
import { syncHoldingsForItem, syncInvestmentTransactionsForItem } from "@/lib/plaidInvestments";
import { syncLiabilitiesForItem } from "@/lib/plaidLiabilities";

// Stands in for /api/plaid/link-token + /api/plaid/exchange when MOCK_MODE
// is on: no Plaid credentials required. Real accounts/plaid_items rows, so
// the rest of the app (balances, health badges, delete) works unmodified.
export async function POST(req: Request) {
  if (!MOCK_MODE) {
    return NextResponse.json({ error: "Mock mode is disabled" }, { status: 403 });
  }

  let userId: string;
  try {
    userId = await requireUserId(req);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const existingItems = await db.query.plaidItems.findMany({ where: eq(schema.plaidItems.userId, userId) });
  const connectedInstitutionIds = new Set(existingItems.map((i) => i.institutionId));

  const next = MOCK_INSTITUTIONS.find((inst) => !connectedInstitutionIds.has(`mock-${inst.id}`));
  if (!next) {
    return NextResponse.json({ error: "All mock institutions are already connected" }, { status: 409 });
  }

  const institutionId = `mock-${next.id}`;

  await db
    .insert(schema.institutions)
    .values({ id: institutionId, name: next.name, primaryColor: next.primaryColor, oauth: false })
    .onConflictDoNothing();

  const [item] = await db
    .insert(schema.plaidItems)
    .values({
      userId,
      plaidItemId: `mock-item-${randomUUID()}`,
      institutionId,
      institutionName: next.name,
      accessTokenCiphertext: "mock",
      accessTokenIv: "mock",
      accessTokenTag: "mock",
      status: "healthy",
      lastSyncedAt: new Date(),
    })
    .returning({ id: schema.plaidItems.id });

  if (!item) throw new Error("Failed to insert mock plaid_items row");

  for (const acct of next.accounts) {
    await db.insert(schema.accounts).values({
      userId,
      itemId: item.id,
      plaidAccountId: `mock-acct-${randomUUID()}`,
      name: acct.name,
      officialName: acct.officialName,
      mask: acct.mask,
      type: acct.type,
      subtype: acct.subtype,
      currency: "USD",
      currentBalance: acct.currentBalance,
      availableBalance: acct.availableBalance,
      creditLimit: acct.creditLimit,
      balanceAsOf: new Date(),
    });
  }

  // Routed through the real sync engines (not the seeders directly) so mock
  // items get the same sync_runs bookkeeping a live initial sync would —
  // the Connections screen's "last synced" reads from that table either way.
  await syncTransactionsForItem(item.id, "initial");
  await syncHoldingsForItem(item.id, "initial");
  await syncInvestmentTransactionsForItem(item.id, "initial");
  await syncLiabilitiesForItem(item.id, "initial");

  return NextResponse.json({ ok: true, itemId: item.id });
}
