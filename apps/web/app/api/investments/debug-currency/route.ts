import { NextResponse } from "next/server";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireUserId } from "@/lib/session";
import { plaidClient, getAccessToken, plaidErrorCode } from "@/lib/plaid";
import { isMockPlaidItemId } from "@/lib/mock/isMock";
import { holdingPriceCurrency, isMarketQuote, listingCurrency } from "@tally/core/listingCurrency";

// TEMPORARY: diagnoses holdings still showing in the wrong currency after
// v1.5.7/1.5.8. For the signed-in user's own items only, it puts side by side
// what Plaid sends right now for each holding, what reconcileHoldings in
// lib/plaidInvestments.ts would decide from it, and what's actually stored.
// Read-only: nothing is written. Remove once the currency bug is settled.
export async function GET(req: Request) {
  let userId: string;
  try {
    userId = await requireUserId(req);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const items = await db
    .select({ id: schema.plaidItems.id, plaidItemId: schema.plaidItems.plaidItemId, institutionName: schema.plaidItems.institutionName })
    .from(schema.plaidItems)
    .where(eq(schema.plaidItems.userId, userId));

  const out = [];
  for (const item of items) {
    if (isMockPlaidItemId(item.plaidItemId)) continue;
    try {
      const res = await plaidClient.investmentsHoldingsGet({ access_token: await getAccessToken(item.id) });
      const { holdings, securities, accounts } = res.data;
      const secById = new Map(securities.map((s) => [s.security_id, s]));
      const acctById = new Map(accounts.map((a) => [a.account_id, a]));

      const ourAccounts = await db
        .select({ id: schema.accounts.id, plaidAccountId: schema.accounts.plaidAccountId })
        .from(schema.accounts)
        .where(and(eq(schema.accounts.userId, userId), inArray(schema.accounts.plaidAccountId, accounts.map((a) => a.account_id))));
      const ourAcctId = new Map(ourAccounts.map((a) => [a.plaidAccountId!, a.id]));

      const rows = [];
      for (const h of holdings) {
        const s = secById.get(h.security_id);
        const institutionPriceLooksBroken = h.institution_price === 0 && h.quantity > 0;
        const usedClosePrice = institutionPriceLooksBroken && s?.close_price != null;
        const priceIsMarketPrice = usedClosePrice || isMarketQuote(h.institution_price, s?.close_price);
        const decided = holdingPriceCurrency({
          priceIsMarketPrice,
          mic: s?.market_identifier_code,
          ticker: s?.ticker_symbol,
          securityCurrency: s?.iso_currency_code ?? s?.unofficial_currency_code,
          holdingCurrency: h.iso_currency_code ?? h.unofficial_currency_code,
        });

        const accountId = ourAcctId.get(h.account_id);
        const [stored] = accountId
          ? await db
              .select({
                asOfDate: schema.holdings.asOfDate,
                currency: schema.holdings.currency,
                institutionPrice: schema.holdings.institutionPrice,
                institutionValue: schema.holdings.institutionValue,
              })
              .from(schema.holdings)
              .innerJoin(schema.securities, eq(schema.securities.id, schema.holdings.securityId))
              .where(and(eq(schema.holdings.accountId, accountId), eq(schema.securities.plaidSecurityId, h.security_id)))
              .orderBy(sql`${schema.holdings.asOfDate} desc`)
              .limit(1)
          : [];

        rows.push({
          ticker: s?.ticker_symbol ?? null,
          name: s?.name ?? null,
          account: acctById.get(h.account_id)?.name ?? null,
          accountCurrency: acctById.get(h.account_id)?.balances.iso_currency_code ?? null,
          plaid: {
            mic: s?.market_identifier_code ?? null,
            securityCurrency: s?.iso_currency_code ?? s?.unofficial_currency_code ?? null,
            holdingCurrency: h.iso_currency_code ?? h.unofficial_currency_code ?? null,
            quantity: h.quantity,
            institutionPrice: h.institution_price,
            institutionPriceAsOf: h.institution_price_as_of ?? null,
            institutionValue: h.institution_value,
            closePrice: s?.close_price ?? null,
            closePriceAsOf: s?.close_price_as_of ?? null,
          },
          decision: {
            usedClosePrice,
            priceRatioToClose: h.institution_price && s?.close_price ? +(h.institution_price / s.close_price).toFixed(4) : null,
            priceIsMarketPrice,
            listingCurrency: listingCurrency(s?.market_identifier_code, s?.ticker_symbol),
            currency: decided,
          },
          stored: stored
            ? { ...stored, institutionPrice: stored.institutionPrice != null ? stored.institutionPrice / 100 : null, institutionValue: stored.institutionValue / 100 }
            : null,
        });
      }
      out.push({ institution: item.institutionName, holdings: rows });
    } catch (err) {
      out.push({ institution: item.institutionName, error: plaidErrorCode(err) ?? (err instanceof Error ? err.message : "unknown error") });
    }
  }

  return NextResponse.json({ checkedAt: new Date().toISOString(), items: out });
}
