import { NextResponse } from "next/server";
import { z } from "zod";
import { and, desc, eq, gte, ilike, inArray, isNull, lte, or, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireUserId } from "@/lib/session";
import { categoryIdsInGroup } from "@/lib/categoryOptions";
import { clearOrphanedRecurringStreamRefs } from "@/lib/recurringBillGeneration";
import { monthLastDay } from "@tally/core/budgetMath";

const PAGE_SIZE = 50;

function currentMonth(): string {
  const now = new Date();
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1)).toISOString().slice(0, 10);
}

interface RawLocation {
  city?: string | null;
  region?: string | null;
}

function locationLabel(raw: unknown): string | null {
  if (!raw || typeof raw !== "object") return null;
  const loc = raw as RawLocation;
  return [loc.city, loc.region].filter(Boolean).join(", ") || null;
}

// List endpoint for the mobile app's Transactions screen (MOBILE_DESIGN.md
// §5.3) — mirrors app/(app)/transactions/page.tsx's filter/pagination logic
// exactly (same query params, same defaulting to the current calendar
// month when no date range is given) so the two surfaces can't drift.
export async function GET(req: Request) {
  let userId: string;
  try {
    userId = await requireUserId(req);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Self-heals a transaction left stuck "Marked as annual" by a stream
  // deleted before undoAmortization existed — see clearOrphanedRecurringStreamRefs.
  await clearOrphanedRecurringStreamRefs(userId);

  const url = new URL(req.url);
  const sp = url.searchParams;
  const q = (sp.get("q") ?? "").trim();
  const accountFilter = sp.get("account") ?? "";
  const pendingOnly = sp.get("pending") === "1";
  const page = Math.max(1, parseInt(sp.get("page") ?? "1", 10) || 1);
  const categoryFilter = sp.get("category") ?? "";
  const merchantFilter = sp.get("merchant") ?? "";
  const thisMonth = currentMonth();
  const hasExplicitDateFilter = sp.has("from") || sp.has("to");
  const fromFilter = sp.get("from") ?? thisMonth;
  const toFilter = sp.get("to") ?? monthLastDay(thisMonth);
  const kindParam = sp.get("kind");
  const kindFilter = kindParam === "income" || kindParam === "expense" ? kindParam : "";
  const transferFilter = sp.get("transfer") === "0" ? false : sp.get("transfer") === "1" ? true : null;
  const excludedFilter = sp.get("excluded") === "0" ? false : sp.get("excluded") === "1" ? true : null;

  const categories = await db.query.categories.findMany({
    where: or(isNull(schema.categories.userId), eq(schema.categories.userId, userId)),
    orderBy: (c, { asc }) => [asc(c.name)],
  });

  const conditions = [eq(schema.transactions.userId, userId)];
  if (accountFilter) conditions.push(eq(schema.transactions.accountId, accountFilter));
  if (pendingOnly) conditions.push(eq(schema.transactions.isPending, true));
  if (categoryFilter) conditions.push(inArray(schema.transactions.categoryId, categoryIdsInGroup(categoryFilter, categories)));
  if (fromFilter) conditions.push(gte(schema.transactions.postedDate, fromFilter));
  if (toFilter) conditions.push(lte(schema.transactions.postedDate, toFilter));
  if (transferFilter != null) conditions.push(eq(schema.transactions.isTransfer, transferFilter));
  if (excludedFilter != null) conditions.push(eq(schema.transactions.excludedFromBudget, excludedFilter));
  if (kindFilter) conditions.push(eq(schema.categories.kind, kindFilter));
  if (merchantFilter) {
    const merchantCondition = or(
      eq(schema.transactions.merchantName, merchantFilter),
      and(isNull(schema.transactions.merchantName), eq(schema.transactions.name, merchantFilter)),
    );
    if (merchantCondition) conditions.push(merchantCondition);
  }
  if (q) {
    const searchCondition = or(ilike(schema.transactions.name, `%${q}%`), ilike(schema.transactions.merchantName, `%${q}%`));
    if (searchCondition) conditions.push(searchCondition);
  }
  const whereClause = and(...conditions);

  const transactionColumns = {
    id: schema.transactions.id,
    postedDate: schema.transactions.postedDate,
    createdAt: schema.transactions.createdAt,
    merchantName: schema.transactions.merchantName,
    name: schema.transactions.name,
    isPending: schema.transactions.isPending,
    accountId: schema.transactions.accountId,
    categoryId: schema.transactions.categoryId,
    categorySource: schema.transactions.categorySource,
    pfcDetailed: schema.transactions.pfcDetailed,
    amount: schema.transactions.amount,
    currency: schema.transactions.currency,
    reviewed: schema.transactions.reviewed,
    notes: schema.transactions.notes,
    tags: schema.transactions.tags,
    excludedFromBudget: schema.transactions.excludedFromBudget,
    location: schema.transactions.location,
    plaidTransactionId: schema.transactions.plaidTransactionId,
    isManual: schema.transactions.isManual,
    recurringStreamId: schema.transactions.recurringStreamId,
  };

  const [rows, countRows] = await Promise.all([
    db
      .select(transactionColumns)
      .from(schema.transactions)
      .leftJoin(schema.categories, eq(schema.transactions.categoryId, schema.categories.id))
      .where(whereClause)
      .orderBy(desc(schema.transactions.postedDate), desc(schema.transactions.createdAt))
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.transactions)
      .leftJoin(schema.categories, eq(schema.transactions.categoryId, schema.categories.id))
      .where(whereClause),
  ]);

  const splitRows = rows.length
    ? await db
        .select({ transactionId: schema.transactionSplits.transactionId, categoryId: schema.transactionSplits.categoryId, amount: schema.transactionSplits.amount, note: schema.transactionSplits.note })
        .from(schema.transactionSplits)
        .where(inArray(schema.transactionSplits.transactionId, rows.map((r) => r.id)))
    : [];
  const splitsByTransaction = new Map<string, { categoryId: string; amount: number; note: string | null }[]>();
  for (const s of splitRows) {
    if (!s.categoryId) continue;
    splitsByTransaction.set(s.transactionId, [...(splitsByTransaction.get(s.transactionId) ?? []), { categoryId: s.categoryId, amount: s.amount, note: s.note }]);
  }

  // Resolved here (not left to the client) so mobile doesn't need its own
  // categories fetch + cross-reference just to show a name instead of a raw
  // Plaid PFC code -- one source of truth for "what does this category
  // display as," same categories list the filter grouping already fetched.
  const categoryById = new Map(categories.map((c) => [c.id, c]));

  const items = rows.map((t) => ({
    id: t.id,
    postedDate: t.postedDate,
    merchantName: t.merchantName,
    name: t.name,
    isPending: t.isPending,
    accountId: t.accountId,
    categoryId: t.categoryId,
    categoryName: t.categoryId ? (categoryById.get(t.categoryId)?.name ?? null) : null,
    categoryColorSlot: t.categoryId ? (categoryById.get(t.categoryId)?.colorSlot ?? null) : null,
    categorySource: t.categorySource,
    pfcDetailed: t.pfcDetailed,
    amount: t.amount,
    currency: t.currency,
    reviewed: t.reviewed,
    notes: t.notes,
    tags: t.tags,
    excludedFromBudget: t.excludedFromBudget,
    locationLabel: locationLabel(t.location),
    plaidTransactionId: t.plaidTransactionId,
    isManual: t.isManual,
    recurringStreamId: t.recurringStreamId,
    splits: splitsByTransaction.get(t.id) ?? [],
  }));

  const total = countRows[0]?.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return NextResponse.json({
    items,
    pagination: { page, pageSize: PAGE_SIZE, total, totalPages },
    dateRange: { from: fromFilter, to: toFilter, isExplicit: hasExplicitDateFilter },
  });
}

const createSchema = z.object({
  accountId: z.string().uuid(),
  postedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  name: z.string().trim().min(1).max(200),
  // Cents, always positive on the wire -- `kind` decides the stored sign
  // (expenses negative, income positive) so callers never have to remember
  // the sign convention themselves.
  amount: z.number().int().positive(),
  kind: z.enum(["expense", "income"]),
  categoryId: z.string().uuid().nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
});

// A purchase Plaid never saw -- cash, a bank this app isn't linked to, or
// just something the user wants tracked without waiting on a sync. Always
// isManual + categorySource "manual" (see schema.ts's isManual comment):
// sync only ever matches rows by plaidTransactionId, so this row is safe
// from being touched or duplicated by the next sync, and it's what lets the
// user delete it again from the detail panel.
export async function POST(req: Request) {
  let userId: string;
  try {
    userId = await requireUserId(req);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = createSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request", issues: parsed.error.issues }, { status: 400 });
  }
  const { accountId, postedDate, name, amount, kind, categoryId, notes } = parsed.data;

  const account = await db.query.accounts.findFirst({ where: eq(schema.accounts.id, accountId) });
  if (!account || account.userId !== userId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (categoryId) {
    const category = await db.query.categories.findFirst({ where: eq(schema.categories.id, categoryId) });
    if (!category || (category.userId !== null && category.userId !== userId)) {
      return NextResponse.json({ error: "Invalid category" }, { status: 400 });
    }
  }

  const [created] = await db
    .insert(schema.transactions)
    .values({
      userId,
      accountId,
      amount: kind === "expense" ? -amount : amount,
      currency: account.currency,
      postedDate,
      name,
      categoryId: categoryId ?? null,
      categorySource: "manual",
      notes: notes ?? null,
      isManual: true,
    })
    .returning();

  return NextResponse.json({ transaction: created }, { status: 201 });
}
