import { NextResponse } from "next/server";
import { and, desc, eq, gte, inArray, lte } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireUserId } from "@/lib/session";
import { toNetWorthCurrency, NET_WORTH_CURRENCY } from "@tally/core/fx";
import { accountDisplayName } from "@tally/core/accountName";

export async function GET(req: Request) {
  let userId: string;
  try {
    userId = await requireUserId(req);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  const accountsParam = url.searchParams.get("accounts");
  const accountIds = accountsParam ? accountsParam.split(",").filter(Boolean) : null;

  const userAccounts = await db
    .select({ id: schema.accounts.id, name: schema.accounts.name, nickname: schema.accounts.nickname })
    .from(schema.accounts)
    .where(and(eq(schema.accounts.userId, userId), eq(schema.accounts.type, "investment")));
  const userAccountIds = new Set(userAccounts.map((a) => a.id));
  const accountNameById = new Map(userAccounts.map((a) => [a.id, accountDisplayName(a.name, a.nickname)]));
  const scopedAccountIds = (accountIds ?? [...userAccountIds]).filter((id) => userAccountIds.has(id));
  if (scopedAccountIds.length === 0) {
    return NextResponse.json({ transactions: [] });
  }

  const conditions = [inArray(schema.investmentTransactions.accountId, scopedAccountIds)];
  if (from) conditions.push(gte(schema.investmentTransactions.date, from));
  if (to) conditions.push(lte(schema.investmentTransactions.date, to));

  const rows = await db
    .select({
      id: schema.investmentTransactions.id,
      accountId: schema.investmentTransactions.accountId,
      date: schema.investmentTransactions.date,
      name: schema.investmentTransactions.name,
      quantity: schema.investmentTransactions.quantity,
      amount: schema.investmentTransactions.amount,
      price: schema.investmentTransactions.price,
      fees: schema.investmentTransactions.fees,
      type: schema.investmentTransactions.type,
      subtype: schema.investmentTransactions.subtype,
      currency: schema.investmentTransactions.currency,
      securityId: schema.investmentTransactions.securityId,
      ticker: schema.securities.ticker,
      securityName: schema.securities.name,
    })
    .from(schema.investmentTransactions)
    .leftJoin(schema.securities, eq(schema.investmentTransactions.securityId, schema.securities.id))
    .where(and(...conditions))
    .orderBy(desc(schema.investmentTransactions.date))
    .limit(500);

  // Converted to NET_WORTH_CURRENCY like holdings, so activity amounts and
  // portfolio figures share one currency; `originalCurrency` keeps the source.
  const transactions = await Promise.all(
    rows.map(async (r) => ({
      ...r,
      accountName: accountNameById.get(r.accountId) ?? "",
      amount: await toNetWorthCurrency(r.amount, r.currency),
      price: r.price != null ? await toNetWorthCurrency(r.price, r.currency) : null,
      currency: NET_WORTH_CURRENCY,
      originalCurrency: r.currency,
    })),
  );
  return NextResponse.json({ transactions });
}
