import { NextResponse } from "next/server";
import { and, desc, eq, inArray, isNotNull, isNull, or } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireUserId } from "@/lib/session";
import { accountDisplayName } from "@tally/core/accountName";
import { suggestCategories } from "@tally/core/transactionView";

/** Rows the review queue loads at once; it refetches when they run out. */
const QUEUE_LIMIT = 100;

/**
 * The review queue: unreviewed, non-transfer transactions (newest first),
 * each with up to three category suggestions -- its current category, then
 * what you picked before for the same merchant.
 */
export async function GET(req: Request) {
  let userId: string;
  try {
    userId = await requireUserId(req);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [rows, categories, accounts] = await Promise.all([
    db
      .select({
        id: schema.transactions.id,
        postedDate: schema.transactions.postedDate,
        merchantName: schema.transactions.merchantName,
        name: schema.transactions.name,
        amount: schema.transactions.amount,
        currency: schema.transactions.currency,
        accountId: schema.transactions.accountId,
        categoryId: schema.transactions.categoryId,
        isPending: schema.transactions.isPending,
      })
      .from(schema.transactions)
      .where(and(eq(schema.transactions.userId, userId), eq(schema.transactions.reviewed, false), eq(schema.transactions.isTransfer, false)))
      .orderBy(desc(schema.transactions.postedDate), desc(schema.transactions.createdAt))
      .limit(QUEUE_LIMIT),
    db.query.categories.findMany({ where: or(isNull(schema.categories.userId), eq(schema.categories.userId, userId)) }),
    db.query.accounts.findMany({ where: eq(schema.accounts.userId, userId) }),
  ]);

  const merchants = [...new Set(rows.map((r) => r.merchantName).filter((m): m is string => !!m))];
  const history = merchants.length
    ? await db
        .select({ merchantName: schema.transactions.merchantName, categoryId: schema.transactions.categoryId })
        .from(schema.transactions)
        .where(
          and(
            eq(schema.transactions.userId, userId),
            eq(schema.transactions.reviewed, true),
            isNotNull(schema.transactions.categoryId),
            inArray(schema.transactions.merchantName, merchants),
          ),
        )
        .orderBy(desc(schema.transactions.postedDate))
        .limit(3000)
    : [];
  const historyByMerchant = new Map<string, string[]>();
  for (const h of history) historyByMerchant.set(h.merchantName!, [...(historyByMerchant.get(h.merchantName!) ?? []), h.categoryId!]);

  const categoryById = new Map(categories.map((c) => [c.id, c]));
  const accountById = new Map(accounts.map((a) => [a.id, accountDisplayName(a.name, a.nickname)]));

  return NextResponse.json({
    total: rows.length,
    items: rows.map((r) => ({
      ...r,
      accountName: accountById.get(r.accountId) ?? "",
      suggestions: suggestCategories(r.categoryId, r.merchantName ? (historyByMerchant.get(r.merchantName) ?? []) : [])
        .map((s) => ({ ...s, name: categoryById.get(s.categoryId)?.name ?? "", colorSlot: categoryById.get(s.categoryId)?.colorSlot ?? 1 }))
        .filter((s) => s.name),
    })),
  });
}
