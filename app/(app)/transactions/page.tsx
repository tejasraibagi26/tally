import { db, schema } from "@/db";
import { and, desc, eq, gte, ilike, inArray, isNull, lte, or, sql } from "drizzle-orm";
import { Receipt, SearchX } from "lucide-react";
import { requireUserId } from "@/lib/session";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { SyncAllButton } from "@/components/plaid/SyncAllButton";
import { TransactionsList, type TransactionRowData, type AccountLookup } from "@/components/transactions/TransactionsList";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import Link from "next/link";

const PAGE_SIZE = 50;

interface RawLocation {
  city?: string | null;
  region?: string | null;
}

function locationLabel(raw: unknown): string | null {
  if (!raw || typeof raw !== "object") return null;
  const loc = raw as RawLocation;
  return [loc.city, loc.region].filter(Boolean).join(", ") || null;
}

interface SearchParams {
  q?: string;
  account?: string;
  pending?: string;
  page?: string;
  category?: string;
  merchant?: string;
  from?: string;
  to?: string;
  kind?: string;
  transfer?: string;
  excluded?: string;
}

export default async function TransactionsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const userId = await requireUserId();
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const accountFilter = sp.account ?? "";
  const pendingOnly = sp.pending === "1";
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
  const categoryFilter = sp.category ?? "";
  const merchantFilter = sp.merchant ?? "";
  const fromFilter = sp.from ?? "";
  const toFilter = sp.to ?? "";
  // These three are drill-down-only (set by Overview links, not exposed in the filter form): they let a metric's
  // link reproduce its exact underlying transaction set, e.g. "Spent this month" excludes transfers/excluded rows.
  const kindFilter = sp.kind === "income" || sp.kind === "expense" ? sp.kind : "";
  const transferFilter = sp.transfer === "0" ? false : sp.transfer === "1" ? true : null;
  const excludedFilter = sp.excluded === "0" ? false : sp.excluded === "1" ? true : null;

  const accounts = await db.query.accounts.findMany({ where: eq(schema.accounts.userId, userId) });
  const accountById = new Map(accounts.map((a) => [a.id, a]));

  const items = await db.query.plaidItems.findMany({ where: eq(schema.plaidItems.userId, userId) });
  const itemById = new Map(items.map((i) => [i.id, i]));
  const accountsById: Record<string, AccountLookup> = {};
  for (const a of accounts) {
    accountsById[a.id] = { name: a.name, mask: a.mask, plaidItemLabel: (a.itemId && itemById.get(a.itemId)?.plaidItemId) || null };
  }

  const categories = await db.query.categories.findMany({
    where: or(isNull(schema.categories.userId), eq(schema.categories.userId, userId)),
    orderBy: (c, { asc }) => [asc(c.name)],
  });
  const categoryOptions = categories.map((c) => ({ id: c.id, name: c.name, colorSlot: c.colorSlot }));

  const conditions = [eq(schema.transactions.userId, userId)];
  if (accountFilter) conditions.push(eq(schema.transactions.accountId, accountFilter));
  if (pendingOnly) conditions.push(eq(schema.transactions.isPending, true));
  if (categoryFilter) conditions.push(eq(schema.transactions.categoryId, categoryFilter));
  if (fromFilter) conditions.push(gte(schema.transactions.postedDate, fromFilter));
  if (toFilter) conditions.push(lte(schema.transactions.postedDate, toFilter));
  if (transferFilter != null) conditions.push(eq(schema.transactions.isTransfer, transferFilter));
  if (excludedFilter != null) conditions.push(eq(schema.transactions.excludedFromBudget, excludedFilter));
  if (kindFilter) conditions.push(eq(schema.categories.kind, kindFilter));
  if (merchantFilter) {
    // Mirrors lib/analytics.ts's merchantBreakdown grouping key (merchantName ?? name).
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
  const hasFilters = Boolean(q || accountFilter || pendingOnly || categoryFilter || merchantFilter || fromFilter || toFilter);

  // Explicit columns (not select-all) + a leftJoin so `kindFilter` can reference categories.kind — this
  // lets a drill-down link reproduce a metric's exact filter set (transfers/excluded/category kind) precisely.
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

  const rowData: TransactionRowData[] = rows.map((t) => ({
    id: t.id,
    postedDate: t.postedDate,
    merchantName: t.merchantName,
    name: t.name,
    isPending: t.isPending,
    accountId: t.accountId,
    categoryId: t.categoryId,
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
    splits: splitsByTransaction.get(t.id) ?? [],
  }));

  const total = countRows[0]?.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const start = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const end = Math.min(page * PAGE_SIZE, total);

  function pageHref(p: number) {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (accountFilter) params.set("account", accountFilter);
    if (pendingOnly) params.set("pending", "1");
    if (categoryFilter) params.set("category", categoryFilter);
    if (merchantFilter) params.set("merchant", merchantFilter);
    if (fromFilter) params.set("from", fromFilter);
    if (toFilter) params.set("to", toFilter);
    if (kindFilter) params.set("kind", kindFilter);
    if (transferFilter != null) params.set("transfer", transferFilter ? "1" : "0");
    if (excludedFilter != null) params.set("excluded", excludedFilter ? "1" : "0");
    if (p > 1) params.set("page", String(p));
    const qs = params.toString();
    return qs ? `/transactions?${qs}` : "/transactions";
  }

  return (
    <div className="max-w-[1280px] mx-auto px-8 py-7 h-full min-h-0 flex flex-col gap-4">
      <div className="flex items-center justify-between flex-none">
        <div className="flex items-baseline gap-3">
          <h1 className="text-2xl font-semibold text-text">Transactions</h1>
          <span className="text-[13.5px] text-text-3 tabular">{total} in range</span>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/rules" className="text-sm text-brand">
            Manage rules →
          </Link>
          <SyncAllButton />
        </div>
      </div>

      <Card className="p-3 flex-none">
        <form method="get" className="flex items-center gap-2 flex-wrap">
          <input
            type="text"
            name="q"
            defaultValue={q}
            placeholder="Search merchant or description"
            className="flex-1 min-w-[220px] h-9 rounded-control bg-surface-2 border border-border-strong px-3 text-[15px] text-text placeholder:text-text-3 focus:outline-none focus:ring-2 focus:ring-info"
          />
          <SearchableSelect
            name="account"
            defaultValue={accountFilter}
            buttonPlaceholder="All accounts"
            placeholder="Search accounts…"
            className="w-52"
            options={[{ value: "", label: "All accounts" }, ...accounts.map((a) => ({ value: a.id, label: `${a.name} ····${a.mask ?? "----"}` }))]}
          />
          <SearchableSelect
            name="category"
            defaultValue={categoryFilter}
            buttonPlaceholder="All categories"
            placeholder="Search categories…"
            className="w-52"
            options={[{ value: "", label: "All categories" }, ...categoryOptions.map((c) => ({ value: c.id, label: c.name, colorSlot: c.colorSlot }))]}
          />
          <input
            type="date"
            name="from"
            defaultValue={fromFilter}
            aria-label="From date"
            className="h-9 rounded-control bg-surface border border-border-strong px-2 text-sm text-text"
          />
          <input
            type="date"
            name="to"
            defaultValue={toFilter}
            aria-label="To date"
            className="h-9 rounded-control bg-surface border border-border-strong px-2 text-sm text-text"
          />
          {merchantFilter && <input type="hidden" name="merchant" value={merchantFilter} />}
          {kindFilter && <input type="hidden" name="kind" value={kindFilter} />}
          {transferFilter != null && <input type="hidden" name="transfer" value={transferFilter ? "1" : "0"} />}
          {excludedFilter != null && <input type="hidden" name="excluded" value={excludedFilter ? "1" : "0"} />}
          <label className="flex items-center gap-1.5 text-sm text-text-2 px-1">
            <input type="checkbox" name="pending" value="1" defaultChecked={pendingOnly} />
            Pending only
          </label>
          <button type="submit" className="h-9 px-3 rounded-control bg-surface border border-border-strong text-sm font-medium text-text hover:bg-sunken">
            Filter
          </button>
          {hasFilters && (
            <Link href="/transactions" className="text-sm text-text-2 px-2">
              Clear
            </Link>
          )}
        </form>
        {merchantFilter && (
          <div className="pt-2 text-[13px] text-text-2">
            Filtered to merchant <span className="text-text font-medium">{merchantFilter}</span>
          </div>
        )}
      </Card>

      <Card className="flex-1 min-h-0 flex flex-col overflow-hidden">
        <div className="grid grid-cols-[92px_minmax(180px,1fr)_150px_170px_120px] gap-3 items-center px-4 py-2.5 bg-surface-2 border-b border-border text-xs font-medium uppercase tracking-wide text-text-3 flex-none">
          <span>Date</span>
          <span>Merchant</span>
          <span>Account</span>
          <span>Category</span>
          <span className="text-right">Amount</span>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto">
          {rows.length === 0 ? (
            <div className="px-4 py-10">
              {total === 0 && !hasFilters ? (
                <EmptyState
                  icon={Receipt}
                  title="Nothing here yet"
                  description="Connect an account, or hit Sync now to pull in your transaction history."
                />
              ) : (
                <EmptyState
                  icon={SearchX}
                  title="No matches"
                  description="Nothing fits these filters. Try widening the date range or clearing one."
                />
              )}
            </div>
          ) : (
            <TransactionsList rows={rowData} accountsById={accountsById} categories={categoryOptions} />
          )}
        </div>

        {total > 0 && (
          <div className="flex items-center justify-between px-4 py-3 text-[13.5px] text-text-3 flex-none border-t border-border">
            <span>
              Showing {start}–{end} of {total}
            </span>
            <div className="flex gap-3">
              <Link
                href={pageHref(Math.max(1, page - 1))}
                className={page <= 1 ? "pointer-events-none text-text-3" : "text-text-2"}
              >
                Previous
              </Link>
              <Link
                href={pageHref(Math.min(totalPages, page + 1))}
                className={page >= totalPages ? "pointer-events-none text-text-3" : "text-text-2"}
              >
                Next
              </Link>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
