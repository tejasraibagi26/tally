import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireUserId } from "@/lib/session";
import { itemStatusToBadge } from "@/lib/freshness";
import { toNetWorthCurrency, NET_WORTH_CURRENCY } from "@tally/core/fx";
import { accountDisplayName } from "@tally/core/accountName";

// List endpoint for the mobile app's Accounts screen (MOBILE_DESIGN.md §5.5) —
// the web app's app/(app)/accounts/page.tsx has always queried the DB
// directly from a Server Component and never needed one. Groups accounts
// under their institution and computes each connection's health badge
// server-side via lib/freshness.ts's itemStatusToBadge, the same function
// the web page now imports, so the two surfaces can't disagree on a badge.
export async function GET(req: Request) {
  let userId: string;
  try {
    userId = await requireUserId(req);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [items, accounts] = await Promise.all([
    db.query.plaidItems.findMany({ where: eq(schema.plaidItems.userId, userId) }),
    db.query.accounts.findMany({ where: eq(schema.accounts.userId, userId) }),
  ]);

  const accountsByItem = new Map<string, typeof accounts>();
  const unlinkedAccounts: typeof accounts = [];
  for (const acct of accounts) {
    if (!acct.itemId) {
      unlinkedAccounts.push(acct);
      continue;
    }
    accountsByItem.set(acct.itemId, [...(accountsByItem.get(acct.itemId) ?? []), acct]);
  }

  const convertedForTotals = await Promise.all(
    accounts.map(async (a) => (a.currentBalance != null ? await toNetWorthCurrency(a.currentBalance, a.currency) : 0)),
  );
  const totalAssets = accounts.reduce((sum, a, i) => (a.type === "depository" || a.type === "investment" ? sum + convertedForTotals[i]! : sum), 0);
  const totalLiabilities = accounts.reduce((sum, a, i) => (a.type === "credit" || a.type === "loan" ? sum + convertedForTotals[i]! : sum), 0);

  // Per-connection net, mirroring the web page's card footer. Two wrinkles the
  // client can't reproduce from the rows it receives: currentBalance is stored
  // positive for every type — a card's balance is what's owed, not held — so
  // credit/loan has to be subtracted, and an institution can hold accounts in
  // more than one currency (TD's CAD + USD chequing), which makes a raw sum of
  // the rows wrong rather than merely unconverted. Both are already solved
  // here, so the total ships converted to NET_WORTH_CURRENCY alongside totals.
  const convertedById = new Map(accounts.map((a, i) => [a.id, convertedForTotals[i]!]));
  const itemTotal = (itemAccounts: typeof accounts) =>
    itemAccounts.reduce((sum, a) => {
      const converted = convertedById.get(a.id) ?? 0;
      return sum + (a.type === "credit" || a.type === "loan" ? -converted : converted);
    }, 0);

  const institutions = items.map((item) => ({
    id: item.id,
    institutionId: item.institutionId,
    institutionName: item.institutionName,
    status: item.status,
    lastSyncedAt: item.lastSyncedAt,
    badge: itemStatusToBadge(item.status, item.lastSyncedAt, item.transactionsUpdateStatus),
    total: itemTotal(accountsByItem.get(item.id) ?? []),
    accounts: (accountsByItem.get(item.id) ?? []).map((a) => ({
      id: a.id,
      name: accountDisplayName(a.name, a.nickname),
      realName: a.name,
      nickname: a.nickname,
      mask: a.mask,
      type: a.type,
      subtype: a.subtype,
      currentBalance: a.currentBalance,
      availableBalance: a.availableBalance,
      currency: a.currency,
    })),
  }));

  return NextResponse.json({
    institutions,
    unlinkedAccounts: unlinkedAccounts.map((a) => ({
      id: a.id,
      name: accountDisplayName(a.name, a.nickname),
      realName: a.name,
      nickname: a.nickname,
      mask: a.mask,
      type: a.type,
      subtype: a.subtype,
      currentBalance: a.currentBalance,
      availableBalance: a.availableBalance,
      currency: a.currency,
    })),
    totals: { assets: totalAssets, liabilities: totalLiabilities, net: totalAssets - totalLiabilities, currency: NET_WORTH_CURRENCY },
  });
}
