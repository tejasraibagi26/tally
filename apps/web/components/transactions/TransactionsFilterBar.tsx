"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CalendarRange, CalendarDays, FilterX } from "lucide-react";
import { shiftMonth, monthLastDay } from "@tally/core/budgetMath";
import { SearchableSelect, type SearchableSelectOption } from "@/components/ui/SearchableSelect";
import { MultiSelect, type MultiSelectOption } from "@/components/ui/MultiSelect";

function monthLabel(month: string): string {
  return new Date(month + "T00:00:00Z").toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
}

function isFullMonthRange(from: string, to: string): boolean {
  return /^\d{4}-\d{2}-01$/.test(from) && to === monthLastDay(from);
}

interface Props {
  initialQ: string;
  initialAccount: string;
  initialCategory: string;
  initialFrom: string;
  initialTo: string;
  initialPending: boolean;
  // The current calendar month's range -- "no date filter at all" server-side
  // (page.tsx) already defaults to this, so it's what "back to no filter"
  // looks like, not empty strings.
  defaultFrom: string;
  defaultTo: string;
  accountOptions: MultiSelectOption[];
  categoryOptions: SearchableSelectOption[];
  // Drill-down-only params (kind/transfer/excluded/merchant) set by a link
  // from Overview/Budgets, not editable from this bar -- carried through
  // unchanged on every navigation it triggers, same as the old form's
  // hidden inputs did on submit.
  passthrough: Record<string, string>;
}

/**
 * Client-side replacement for the old `<form method="get">` filter bar --
 * every field now applies immediately (debounced for the free-text search)
 * instead of waiting for an explicit Filter button, via router.replace on
 * this same route. Next's Server Component page re-fetches from the new
 * searchParams automatically; replace (not push) keeps filter tweaks out of
 * browser history so Back still means "leave this page," not "undo one
 * filter change."
 *
 * The date control defaults to a single-month stepper (◄ month ►, matching
 * Budgets' nav) since "what did I do this month" is the common case; a
 * "Custom range" toggle swaps in the old two native date inputs for
 * anything else.
 */
export function TransactionsFilterBar({
  initialQ,
  initialAccount,
  initialCategory,
  initialFrom,
  initialTo,
  initialPending,
  defaultFrom,
  defaultTo,
  accountOptions,
  categoryOptions,
  passthrough,
}: Props) {
  const router = useRouter();

  const [q, setQ] = useState(initialQ);
  const [account, setAccount] = useState(initialAccount);
  const [category, setCategory] = useState(initialCategory);
  const [from, setFrom] = useState(initialFrom);
  const [to, setTo] = useState(initialTo);
  const [pending, setPending] = useState(initialPending);
  const [dateMode, setDateMode] = useState<"month" | "range">(isFullMonthRange(initialFrom, initialTo) ? "month" : "range");

  // Re-sync from props after a navigation this bar didn't itself initiate
  // lands (the Clear link below, or a drill-down link from Overview/
  // Budgets landing on this same route) -- otherwise this component's state
  // would keep showing the pre-navigation values since React reuses the
  // mounted instance across a same-route search-param change.
  useEffect(() => {
    setQ(initialQ);
    setAccount(initialAccount);
    setCategory(initialCategory);
    setFrom(initialFrom);
    setTo(initialTo);
    setPending(initialPending);
    setDateMode(isFullMonthRange(initialFrom, initialTo) ? "month" : "range");
  }, [initialQ, initialAccount, initialCategory, initialFrom, initialTo, initialPending]);

  function navigate(next: Partial<{ q: string; account: string; category: string; from: string; to: string; pending: boolean }>) {
    const merged = { q, account, category, from, to, pending, ...next };
    const params = new URLSearchParams();
    if (merged.q) params.set("q", merged.q);
    if (merged.account) params.set("account", merged.account);
    if (merged.category) params.set("category", merged.category);
    if (merged.from) params.set("from", merged.from);
    if (merged.to) params.set("to", merged.to);
    if (merged.pending) params.set("pending", "1");
    for (const [k, v] of Object.entries(passthrough)) params.set(k, v);
    router.replace(params.toString() ? `/transactions?${params.toString()}` : "/transactions", { scroll: false });
  }

  // Search-as-you-type: local state updates every keystroke for a
  // responsive input, but the navigation (and the DB query it triggers)
  // waits for a 400ms pause so it's not firing on every character.
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  function handleQChange(value: string) {
    setQ(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => navigate({ q: value }), 400);
  }
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  function goToMonth(month: string) {
    const f = month;
    const t = monthLastDay(f);
    setFrom(f);
    setTo(t);
    navigate({ from: f, to: t });
  }

  function toggleDateMode() {
    if (dateMode === "month") {
      setDateMode("range");
      return;
    }
    // Coming back from a custom range: land on the month `from` falls in
    // rather than snapping to today's month, so "Custom Jun 3–Jun 20" →
    // "Month view" lands on June, not wherever "today" happens to be.
    const f = isFullMonthRange(from, to) ? from : `${from.slice(0, 7)}-01`;
    setDateMode("month");
    goToMonth(f);
  }

  const hasFilters = Boolean(q || account || pending || category || from !== defaultFrom || to !== defaultTo || Object.keys(passthrough).length > 0);

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <input
        type="text"
        value={q}
        onChange={(e) => handleQChange(e.target.value)}
        id="transactions-search"
        placeholder="Search merchant or description"
        className="flex-1 min-w-[220px] h-9 rounded-control bg-surface-2 border border-border-strong px-3 text-[15px] text-text placeholder:text-text-3 focus:outline-none focus:ring-2 focus:ring-info"
      />
      <MultiSelect
        values={account ? account.split(",") : []}
        onChange={(values) => {
          const joined = values.join(",");
          setAccount(joined);
          navigate({ account: joined });
        }}
        buttonPlaceholder="All accounts"
        placeholder="Search accounts…"
        className="w-52"
        options={accountOptions}
      />
      <SearchableSelect
        value={category}
        onChange={(v) => {
          setCategory(v);
          navigate({ category: v });
        }}
        buttonPlaceholder="All categories"
        placeholder="Search categories…"
        className="w-52"
        options={categoryOptions}
      />

      {dateMode === "month" ? (
        <div className="flex items-center h-9 rounded-control bg-surface-2 border border-border-strong px-1">
          <button
            type="button"
            onClick={() => goToMonth(shiftMonth(from, -1))}
            className="w-7 h-7 flex items-center justify-center text-text-2 hover:text-text"
            aria-label="Previous month"
            title="Previous month"
          >
            ←
          </button>
          <span className="text-sm text-text px-1.5 min-w-[124px] text-center tabular">{monthLabel(from)}</span>
          <button
            type="button"
            onClick={() => goToMonth(shiftMonth(from, 1))}
            className="w-7 h-7 flex items-center justify-center text-text-2 hover:text-text"
            aria-label="Next month"
            title="Next month"
          >
            →
          </button>
        </div>
      ) : (
        <>
          <input
            type="date"
            value={from}
            onChange={(e) => {
              setFrom(e.target.value);
              navigate({ from: e.target.value });
            }}
            aria-label="From date"
            className="h-9 rounded-control bg-surface border border-border-strong px-2 text-sm text-text"
          />
          <input
            type="date"
            value={to}
            onChange={(e) => {
              setTo(e.target.value);
              navigate({ to: e.target.value });
            }}
            aria-label="To date"
            className="h-9 rounded-control bg-surface border border-border-strong px-2 text-sm text-text"
          />
        </>
      )}
      <button
        type="button"
        onClick={toggleDateMode}
        title={dateMode === "month" ? "Switch to a custom date range" : "Switch to month view"}
        aria-label={dateMode === "month" ? "Switch to a custom date range" : "Switch to month view"}
        className="w-9 h-9 flex-none flex items-center justify-center rounded-control bg-surface border border-border-strong text-text-2 hover:text-text hover:bg-sunken"
      >
        {dateMode === "month" ? <CalendarRange size={15} strokeWidth={2} /> : <CalendarDays size={15} strokeWidth={2} />}
      </button>

      <label className="flex items-center gap-1.5 text-sm text-text-2 px-1">
        <input
          type="checkbox"
          checked={pending}
          onChange={(e) => {
            setPending(e.target.checked);
            navigate({ pending: e.target.checked });
          }}
        />
        Pending only
      </label>

      {hasFilters && (
        <Link
          href="/transactions"
          title="Clear all filters"
          className="h-9 px-3 flex-none flex items-center gap-1.5 rounded-control bg-surface border border-border-strong text-sm font-medium text-text-2 hover:text-negative hover:border-negative/40 hover:bg-negative-subtle"
        >
          <FilterX size={14} strokeWidth={2} />
          Clear
        </Link>
      )}
    </div>
  );
}
