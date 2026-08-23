import { NextResponse } from "next/server";
import { db, schema } from "@/db";
import { and, eq, ilike, inArray } from "drizzle-orm";
import { requireUserId } from "@/lib/session";
import { plaidClient, getAccessToken } from "@/lib/plaid";

/**
 * TEMPORARY diagnostic route — investigating a Wealthsimple investment value
 * mismatch between what Plaid reports and what Wealthsimple's own app shows.
 * Session-authenticated, read-only, Wealthsimple-scoped. Remove after use.
 */
export async function GET() {
  let userId: string;
  try {
    userId = await requireUserId();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const items = await db.query.plaidItems.findMany({
    where: and(eq(schema.plaidItems.userId, userId), ilike(schema.plaidItems.institutionName, "%Wealthsimple%")),
  });

  const result = [];
  for (const item of items) {
    const accessToken = await getAccessToken(item.id);
    const live = await plaidClient.investmentsHoldingsGet({ access_token: accessToken });

    const accounts = await db.query.accounts.findMany({ where: eq(schema.accounts.itemId, item.id) });
    const accountIds = accounts.map((a) => a.id);
    const storedHoldings = accountIds.length
      ? await db.query.holdings.findMany({ where: inArray(schema.holdings.accountId, accountIds) })
      : [];
    const securityIds = [...new Set(storedHoldings.map((h) => h.securityId))];
    const storedSecurities = securityIds.length
      ? await db.query.securities.findMany({ where: inArray(schema.securities.id, securityIds) })
      : [];
    const securityById = new Map(storedSecurities.map((s) => [s.id, s]));

    result.push({
      institutionName: item.institutionName,
      accounts: accounts.map((a) => ({ id: a.id, name: a.name, plaidAccountId: a.plaidAccountId })),
      liveFromPlaid: {
        accounts: live.data.accounts.map((a) => ({ account_id: a.account_id, name: a.name })),
        holdings: live.data.holdings,
        securities: live.data.securities,
      },
      storedInOurDb: storedHoldings.map((h) => {
        const sec = securityById.get(h.securityId);
        return {
          accountId: h.accountId,
          security: sec ? { ticker: sec.ticker, name: sec.name, closePrice: sec.closePrice, closePriceAsOf: sec.closePriceAsOf, currency: sec.currency } : null,
          quantity: h.quantity,
          costBasis: h.costBasis,
          institutionPrice: h.institutionPrice,
          institutionPriceAsOf: h.institutionPriceAsOf,
          institutionValue: h.institutionValue,
          currency: h.currency,
          asOfDate: h.asOfDate,
        };
      }),
    });
  }

  return NextResponse.json({ items: result });
}
