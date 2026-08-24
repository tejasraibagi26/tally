import { NextResponse } from "next/server";
import { db, schema } from "@/db";
import { eq } from "drizzle-orm";
import { requireUserId } from "@/lib/session";
import { syncTransactionsForItem } from "@/lib/plaidSync";
import { refreshAccountBalances } from "@/lib/plaidBalances";
import { syncHoldingsForItem, syncInvestmentTransactionsForItem } from "@/lib/plaidInvestments";
import { syncLiabilitiesForItem } from "@/lib/plaidLiabilities";
import { runSyncStep, type SyncFailure, type SyncProduct } from "@/lib/syncSteps";

const ALL_PRODUCTS: SyncProduct[] = ["balances", "transactions", "holdings", "investments", "liabilities"];

const SYNC_FNS: Record<SyncProduct, (itemId: string) => Promise<unknown>> = {
  balances: (id) => refreshAccountBalances(id, "manual"),
  transactions: (id) => syncTransactionsForItem(id, "manual"),
  holdings: (id) => syncHoldingsForItem(id, "manual"),
  investments: (id) => syncInvestmentTransactionsForItem(id, "manual"),
  liabilities: (id) => syncLiabilitiesForItem(id, "manual"),
};

// Backs every page's "Sync now" button — each page requests only the
// product(s) it actually displays (e.g. Accounts sends ["balances"],
// Investments sends ["holdings", "investments"]) so a page never reports —
// or retries — a failure for data it doesn't show. Syncs every item the user
// owns. Sequential per item (each item already serializes its own pages
// internally); fine at this account count, revisit if that changes.
export async function POST(req: Request) {
  let userId: string;
  try {
    userId = await requireUserId();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let products = ALL_PRODUCTS;
  const body = await req.json().catch(() => null);
  if (Array.isArray(body?.products) && body.products.length > 0) {
    const requested = (body.products as unknown[]).filter((p): p is SyncProduct => typeof p === "string" && p in SYNC_FNS);
    if (requested.length > 0) products = requested;
  }

  const items = await db
    .select({ id: schema.plaidItems.id, institutionName: schema.plaidItems.institutionName })
    .from(schema.plaidItems)
    .where(eq(schema.plaidItems.userId, userId));

  const results = [];
  for (const item of items) {
    const failures: SyncFailure[] = [];
    for (const product of products) {
      await runSyncStep(product, () => SYNC_FNS[product](item.id), failures);
    }
    results.push({ itemId: item.id, institutionName: item.institutionName, failures });
  }

  return NextResponse.json({ ok: true, results });
}
