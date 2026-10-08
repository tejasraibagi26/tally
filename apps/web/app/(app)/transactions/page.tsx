import { db, schema } from "@/db";
import { resolveMerchantLogos } from "@/lib/merchantLogos";
import { and, desc, eq, gte, ilike, inArray, isNull, lte, or, sql } from "drizzle-orm";
import { Receipt, SearchX } from "lucide-react";
import { requireUserId } from "@/lib/session";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader, SyncFreshness } from "@/components/ui/PageHeader";
import { SyncButton } from "@/components/plaid/SyncButton";
import { SyncFailureBanner } from "@/components/plaid/SyncFailureBanner";
import { TransactionsList, type TransactionRowData, type AccountLookup } from "@/components/transactions/TransactionsList";
import { EmptyPeriodIllustration } from "@/components/transactions/EmptyPeriodIllustration";
import { AddTransactionForm } from "@/components/transactions/AddTransactionForm";
import { TransactionsFilterBar } from "@/components/transactions/TransactionsFilterBar";
import { groupCategoryOptions, categoryIdsInGroup } from "@/lib/categoryOptions";
import { clearOrphanedRecurringStreamRefs } from "@/lib/recurringBillGeneration";
import { monthLastDay } from "@tally/core/budgetMath";
import { formatCents } from "@tally/core/money";
import { accountDisplayName } from "@tally/core/accountName";
import Link from "next/link";
import { currentMonthFor, todayFor } from "@/lib/userTimezone";
import { DEFAULT_CURRENCY } from "@tally/core/fx";
import { ReviewQueue } from "@/components/transactions/ReviewQueue";

const PAGE_SIZE = 50;

function monthLabel(month: string): string {
  return new Date(month + "T00:00:00Z").toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
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
  /** "1" = only transactions that still need review. */
  review?: string;
}

export default async function TransactionsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const userId = await requireUserId();
  // Self-heals a transaction left stuck "Marked as annual" by a stream
  // deleted before undoAmortization existed — see clearOrphanedRecurringStreamRefs.
  await clearOrphanedRecurringStreamRefs(userId);
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  // Comma-joined for a multi-account filter (mobile's filter sheet supports
  // selecting several accounts at once); a bare single id still works the
  // same as before.
  const accountFilter = sp.account ?? "";
  const accountIds = accountFilter.split(",").map((s) => s.trim()).filter(Boolean);
  const pendingOnly = sp.pending === "1";
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
  const categoryFilter = sp.category ?? "";
  const merchantFilter = sp.merchant ?? "";
  // Undefined (never touched) defaults to the current calendar month — a
  // bare /transactions shouldn't dump all-time history and silently mix in
  // prior months' spend. An explicit "" (the date inputs cleared and the
  // form resubmitted) is a deliberate "show all time" and is left alone.
  const thisMonth = (await currentMonthFor(userId));
  const hasExplicitDateFilter = sp.from !== undefined || sp.to !== undefined;
  const fromFilter = sp.from ?? thisMonth;
  const toFilter = sp.to ?? monthLastDay(thisMonth);
  // These three are drill-down-only (set by Overview links, not exposed in the filter form): they let a metric's
  // link reproduce its exact underlying transaction set, e.g. "Spent this month" excludes transfers/excluded rows.
  const kindFilter = sp.kind === "income" || sp.kind === "expense" ? sp.kind : "";
  const transferFilter = sp.transfer === "0" ? false : sp.transfer === "1" ? true : null;
  const excludedFilter = sp.excluded === "0" ? false : sp.excluded === "1" ? true : null;
  const reviewOnly = sp.review === "1";
  const today = await todayFor(userId);

  const accounts = await db.query.accounts.findMany({ where: eq(schema.accounts.userId, userId) });
  const accountById = new Map(accounts.map((a) => [a.id, a]));

  const items = await db.query.plaidItems.findMany({ where: eq(schema.plaidItems.userId, userId) });
  const itemById = new Map(items.map((i) => [i.id, i]));
  const accountsById: Record<string, AccountLookup> = {};
  for (const a of accounts) {
    accountsById[a.id] = { name: accountDisplayName(a.name, a.nickname), mask: a.mask, plaidItemLabel: (a.itemId && itemById.get(a.itemId)?.plaidItemId) || null };
  }

  const categories = await db.query.categories.findMany({
    where: or(isNull(schema.categories.userId), eq(schema.categories.userId, userId)),
    orderBy: (c, { asc }) => [asc(c.name)],
  });
  const categoryOptions = groupCategoryOptions(categories);
  // No "All accounts" placeholder entry here (unlike categorySelectOptions
  // below) -- MultiSelect's empty-selection state already reads "All
  // accounts" from its buttonPlaceholder, so a selectable "" row would be
  // meaningless alongside real picks.
  const accountSelectOptions = accounts.map((a) => ({ value: a.id, label: `${accountDisplayName(a.name, a.nickname)} ····${a.mask ?? "----"}` }));
  const categorySelectOptions = [
    { value: "", label: "All categories" },
    ...categoryOptions.map((c) => ({ value: c.id, label: c.name, colorSlot: c.colorSlot, indent: c.indent })),
  ];
  // Drill-down-only params a link from Overview/Budgets can arrive with
  // (kind/transfer/excluded so it can reproduce a metric's exact underlying
  // set, merchant from a merchant-breakdown link) -- not editable from the
  // filter bar itself, just carried through unchanged on every filter
  // change it makes, same as the old form's hidden inputs did on submit.
  const passthroughParams: Record<string, string> = {};
  if (merchantFilter) passthroughParams.merchant = merchantFilter;
  if (kindFilter) passthroughParams.kind = kindFilter;
  if (transferFilter != null) passthroughParams.transfer = transferFilter ? "1" : "0";
  if (excludedFilter != null) passthroughParams.excluded = excludedFilter ? "1" : "0";
  if (reviewOnly) passthroughParams.review = "1";

  const conditions = [eq(schema.transactions.userId, userId)];
  if (accountIds.length === 1) conditions.push(eq(schema.transactions.accountId, accountIds[0]!));
  else if (accountIds.length > 1) conditions.push(inArray(schema.transactions.accountId, accountIds));
  if (pendingOnly) conditions.push(eq(schema.transactions.isPending, true));
  // A parent category (e.g. "Medical") rolls up every transaction filed under one of its
  // subcategories (e.g. "Dental care") too — selecting the parent shouldn't show nothing just
  // because every transaction actually got tagged with the more specific child category.
  if (categoryFilter) conditions.push(inArray(schema.transactions.categoryId, categoryIdsInGroup(categoryFilter, categories)));
  if (fromFilter) conditions.push(gte(schema.transactions.postedDate, fromFilter));
  if (toFilter) conditions.push(lte(schema.transactions.postedDate, toFilter));
  if (transferFilter != null) conditions.push(eq(schema.transactions.isTransfer, transferFilter));
  if (excludedFilter != null) conditions.push(eq(schema.transactions.excludedFromBudget, excludedFilter));
  if (reviewOnly) conditions.push(eq(schema.transactions.reviewed, false));
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
  const hasFilters = Boolean(q || accountFilter || pendingOnly || categoryFilter || merchantFilter || hasExplicitDateFilter || reviewOnly);

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
    categoryKind: schema.categories.kind,
    isTransfer: schema.transactions.isTransfer,
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
    source: schema.transactions.source,
    recurringStreamId: schema.transactions.recurringStreamId,
    // The split term of the stream this charge is spread by (null if none).
    amortizeMonths: schema.recurringStreams.amortizeMonths,
    logoUrl: schema.transactions.logoUrl,
    counterparties: schema.transactions.counterparties,
  };

  const [rows, countRows, anyTxRow] = await Promise.all([
    db
      .select(transactionColumns)
      .from(schema.transactions)
      .leftJoin(schema.categories, eq(schema.transactions.categoryId, schema.categories.id))
      .leftJoin(schema.recurringStreams, eq(schema.transactions.recurringStreamId, schema.recurringStreams.id))
      .where(whereClause)
      .orderBy(desc(schema.transactions.postedDate), desc(schema.transactions.createdAt))
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE),
    // Spend uses lib/analytics.ts monthTotals' definition (expense categories,
    // transfers and excluded rows left out) so the header matches Overview's
    // "Spent this month" for the same period -- just narrowed by any filters.
    db
      .select({
        count: sql<number>`count(*)::int`,
        spend: sql<number>`coalesce(sum(abs(${schema.transactions.amount})) filter (where ${schema.categories.kind} = 'expense' and not ${schema.transactions.isTransfer} and not ${schema.transactions.excludedFromBudget}), 0)::float8`,
        unreviewed: sql<number>`(count(*) filter (where not ${schema.transactions.reviewed}))::int`,
      })
      .from(schema.transactions)
      .leftJoin(schema.categories, eq(schema.transactions.categoryId, schema.categories.id))
      .leftJoin(schema.recurringStreams, eq(schema.transactions.recurringStreamId, schema.recurringStreams.id))
      .where(whereClause),
    db.select({ id: schema.transactions.id }).from(schema.transactions).where(eq(schema.transactions.userId, userId)).limit(1),
  ]);
  const hasAnyTransactions = anyTxRow.length > 0;

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

  const logos = await resolveMerchantLogos(userId, rows);
  const rowData: TransactionRowData[] = rows.map((t) => ({
    id: t.id,
    postedDate: t.postedDate,
    merchantName: t.merchantName,
    name: t.name,
    isPending: t.isPending,
    accountId: t.accountId,
    categoryId: t.categoryId,
    categorySource: t.categorySource,
    categoryKind: t.categoryKind,
    isTransfer: t.isTransfer,
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
    source: t.source,
    recurringStreamId: t.recurringStreamId,
    amortizeMonths: t.amortizeMonths ?? null,
    splits: splitsByTransaction.get(t.id) ?? [],
    logoUrl: logos.get(t.id) ?? null,
  }));

  const total = countRows[0]?.count ?? 0;
  const periodSpend = Number(countRows[0]?.spend ?? 0);
  const unreviewed = countRows[0]?.unreviewed ?? 0;
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
    if (reviewOnly) params.set("review", "1");
    if (p > 1) params.set("page", String(p));
    const qs = params.toString();
    return qs ? `/transactions?${qs}` : "/transactions";
  }

  // The "To review" chip: same filters, page 1, review toggled.
  const reviewParams = new URLSearchParams(pageHref(1).split("?")[1] ?? "");
  if (reviewOnly) reviewParams.delete("review");
  else reviewParams.set("review", "1");
  const reviewToggleHref = reviewParams.toString() ? `/transactions?${reviewParams}` : "/transactions";

  return (
    <div className="max-w-[1280px] mx-auto px-4 lg:px-8 py-5 lg:py-7 h-full min-h-0 flex flex-col gap-4">
      <PageHeader
        eyebrow="Your money"
        title="Transactions"
        figure={formatCents(periodSpend)}
        figureContext={
          <>
            spent across <span className="font-medium text-text">{total}</span> transaction{total === 1 ? "" : "s"}{" "}
            {hasExplicitDateFilter ? "in this range" : `in ${monthLabel(thisMonth).split(" ")[0]}`}

          </>
        }
        meta={[<SyncFreshness key="sync" syncedAt={items.map((i) => i.lastSyncedAt)} />]}
        actions={
          <>
            <Link href="/rules" className="text-sm text-brand mr-1.5">
              Manage rules →
            </Link>
            <ReviewQueue categories={categoryOptions} pendingCount={unreviewed} />
            <SyncButton products={["transactions"]} />
            <AddTransactionForm
              accounts={accounts.map((a) => ({ id: a.id, name: accountDisplayName(a.name, a.nickname), mask: a.mask }))}
              categories={categoryOptions}
            />
          </>
        }
      />

      <SyncFailureBanner />

      <Card className="p-3 flex-none">
        <TransactionsFilterBar
          initialQ={q}
          initialAccount={accountFilter}
          initialCategory={categoryFilter}
          initialFrom={fromFilter}
          initialTo={toFilter}
          initialPending={pendingOnly}
          defaultFrom={thisMonth}
          defaultTo={monthLastDay(thisMonth)}
          accountOptions={accountSelectOptions}
          categoryOptions={categorySelectOptions}
          passthrough={passthroughParams}
        />
        {(unreviewed > 0 || reviewOnly) && (
          <div className="pt-2 flex items-center gap-2 text-[13px]">
            <Link
              href={reviewToggleHref}
              className={reviewOnly ? "px-3 py-1 rounded-full bg-brand-subtle text-brand" : "px-3 py-1 rounded-full border border-border text-warning hover:bg-warning-subtle"}
            >
              {reviewOnly ? "Showing only to review ✕" : `To review · ${unreviewed}`}
            </Link>
          </div>
        )}
        {merchantFilter && (
          <div className="pt-2 text-[13px] text-text-2">
            Filtered to merchant <span className="text-text font-medium">{merchantFilter}</span>
          </div>
        )}
      </Card>

      {rows.length === 0 ? (
        <Card className="flex-none p-10">
          {!hasAnyTransactions ? (
            <EmptyState
              icon={Receipt}
              title="Nothing here yet"
              description="Connect an account, or hit Sync now to pull in your transaction history."
            />
          ) : !hasFilters ? (
            <EmptyState
              illustration={<EmptyPeriodIllustration />}
              title={`No transactions in ${monthLabel(thisMonth)}`}
              description="Nothing's posted yet this month. Use the date filters above to look at a different period."
            />
          ) : (
            <EmptyState
              icon={SearchX}
              title="No matches"
              description="Nothing fits these filters. Try widening the date range or clearing one."
            />
          )}
        </Card>
      ) : (
        <Card className="flex-1 min-h-0 flex flex-col overflow-hidden">
          <div className="hidden lg:grid grid-cols-[20px_28px_minmax(180px,1fr)_minmax(150px,200px)_130px_110px] gap-x-3 items-center px-4 py-2.5 bg-surface-2 border-b border-border text-xs font-medium uppercase tracking-wide text-text-3 flex-none">
            <span />
            <span />
            <span>Merchant</span>
            <span>Category</span>
            <span>Account</span>
            <span className="text-right">Amount</span>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto">
            <TransactionsList rows={rowData} accountsById={accountsById} categories={categoryOptions} today={today} defaultCurrency={DEFAULT_CURRENCY} />
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
      )}
    </div>
  );
}
