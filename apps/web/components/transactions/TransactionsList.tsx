"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { formatCents } from "@tally/core/money";
import { prettifyPfc } from "@tally/core/pfc";
import { describeTransactionRow, groupByDay } from "@tally/core/transactionView";
import { cn } from "@/lib/cn";
import { CategoryPicker } from "@/components/transactions/CategoryPicker";
import { TransactionDetailPanel, type TransactionDetailData, type DetailCategoryOption, type DetailSplit } from "@/components/transactions/TransactionDetailPanel";

export interface TransactionRowData {
  id: string;
  postedDate: string;
  merchantName: string | null;
  name: string;
  isPending: boolean;
  accountId: string;
  categoryId: string | null;
  categorySource: string;
  /** The category's kind (expense/income/transfer), for refund detection. */
  categoryKind: string | null;
  isTransfer: boolean;
  pfcDetailed: string | null;
  amount: number;
  currency: string;
  reviewed: boolean;
  notes: string | null;
  tags: string[];
  excludedFromBudget: boolean;
  locationLabel: string | null;
  plaidTransactionId: string | null;
  isManual: boolean;
  source: string | null;
  recurringStreamId: string | null;
  amortizeMonths: number | null;
  splits: DetailSplit[];
}

export interface AccountLookup {
  name: string;
  mask: string | null;
  plaidItemLabel: string | null;
}

/**
 * The transactions list: rows grouped under sticky day headers (with that
 * day's net), one status mark per row (@tally/core/transactionView), the
 * category chip as an inline picker, multi-select with a bulk action bar,
 * and keyboard control -- j/k move, x select, c category, e reviewed,
 * Enter open, / search, Esc clear.
 */
export function TransactionsList({
  rows,
  accountsById,
  categories,
  today,
  defaultCurrency,
}: {
  rows: TransactionRowData[];
  accountsById: Record<string, AccountLookup>;
  categories: DetailCategoryOption[];
  today: string;
  defaultCurrency: string;
}) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [checked, setChecked] = useState<ReadonlySet<string>>(new Set());
  const [cursor, setCursor] = useState<number>(-1);
  const [pickerFor, setPickerFor] = useState<string | "bulk" | null>(null);
  const [busy, setBusy] = useState(false);
  const selected = rows.find((r) => r.id === selectedId) ?? null;
  const categoryById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const groups = useMemo(() => groupByDay(rows, today), [rows, today]);
  const order = useMemo(() => groups.flatMap((g) => g.rows.map((r) => r.id)), [groups]);

  // The open transaction lives in the URL (?tx=) so it can be linked;
  // replaceState keeps it out of history.
  useEffect(() => {
    const tx = new URLSearchParams(window.location.search).get("tx");
    if (tx) setSelectedId(tx);
  }, []);
  const openTransaction = useCallback((id: string | null) => {
    setSelectedId(id);
    const params = new URLSearchParams(window.location.search);
    if (id) params.set("tx", id);
    else params.delete("tx");
    const qs = params.toString();
    window.history.replaceState(window.history.state, "", qs ? `${window.location.pathname}?${qs}` : window.location.pathname);
  }, []);
  const navigate = useCallback(
    (dir: 1 | -1) => {
      const i = order.indexOf(selectedId ?? "");
      const next = order[i + dir];
      if (next) {
        openTransaction(next);
        setCursor(i + dir);
      }
    },
    [order, selectedId, openTransaction],
  );

  // A new page of rows clears selection and the keyboard cursor.
  useEffect(() => {
    setChecked(new Set());
    setCursor(-1);
  }, [rows]);

  function toDetail(row: TransactionRowData): TransactionDetailData {
    const account = accountsById[row.accountId];
    return {
      id: row.id,
      plaidTransactionId: row.plaidTransactionId,
      merchantName: row.merchantName,
      name: row.name,
      amount: row.amount,
      currency: row.currency,
      postedDate: row.postedDate,
      isPending: row.isPending,
      isTransfer: row.isTransfer,
      categoryId: row.categoryId,
      categorySource: row.categorySource,
      notes: row.notes,
      tags: row.tags,
      excludedFromBudget: row.excludedFromBudget,
      reviewed: row.reviewed,
      locationLabel: row.locationLabel,
      accountName: account?.name ?? "—",
      accountMask: account?.mask ?? null,
      plaidItemLabel: account?.plaidItemLabel ?? null,
      isManual: row.isManual,
      recurringStreamId: row.recurringStreamId,
      amortizeMonths: row.amortizeMonths,
      splits: row.splits,
    };
  }

  const bulk = useCallback(
    async (ids: string[], action: { type: "setCategory"; categoryId: string } | { type: "markReviewed" } | { type: "exclude"; value: boolean }) => {
      if (ids.length === 0) return;
      setBusy(true);
      try {
        const res = await fetch("/api/transactions/bulk", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids, action }) });
        if (!res.ok) throw new Error("Bulk update failed");
        setChecked(new Set());
        router.refresh();
      } catch (err) {
        console.error(err);
        window.alert("Couldn't update those transactions. Try again.");
      } finally {
        setBusy(false);
        setPickerFor(null);
      }
    },
    [router],
  );

  function toggle(id: string) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // Keyboard control (ignored while typing in a field or with a panel open).
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT" || target.isContentEditable)) return;
      if (selectedId || e.metaKey || e.ctrlKey || e.altKey) return;
      const id = order[cursor];
      if (e.key === "/") {
        e.preventDefault();
        document.getElementById("transactions-search")?.focus();
      } else if (e.key === "j" || e.key === "ArrowDown") {
        e.preventDefault();
        setCursor((c) => Math.min(order.length - 1, c + 1));
      } else if (e.key === "k" || e.key === "ArrowUp") {
        e.preventDefault();
        setCursor((c) => Math.max(0, c - 1));
      } else if (e.key === "x" && id) {
        toggle(id);
      } else if (e.key === "c" && (checked.size > 0 || id)) {
        e.preventDefault();
        setPickerFor(checked.size > 0 ? "bulk" : id!);
      } else if (e.key === "e" && (checked.size > 0 || id)) {
        void bulk(checked.size > 0 ? [...checked] : [id!], { type: "markReviewed" });
      } else if (e.key === "Enter" && id) {
        openTransaction(id);
      } else if (e.key === "Escape") {
        setChecked(new Set());
        setPickerFor(null);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [order, cursor, checked, selectedId, bulk, openTransaction]);

  useEffect(() => {
    const id = order[cursor];
    if (id) document.getElementById(`txn-${id}`)?.scrollIntoView({ block: "nearest" });
  }, [cursor, order]);

  const checkedRows = rows.filter((r) => checked.has(r.id));
  const checkedTotal = checkedRows.reduce((s, r) => s + r.amount, 0);

  return (
    <>
      {groups.map((g) => (
        <section key={g.date}>
          <div className="sticky top-0 z-10 flex items-center justify-between px-4 py-1.5 bg-sunken border-b border-border text-[11px] font-semibold uppercase tracking-wide text-text-3">
            <h3 className="m-0 text-[11px] font-semibold">{g.label}</h3>
            <span className="tabular normal-case tracking-normal font-medium text-xs">{formatCents(g.net, { signed: true })}</span>
          </div>
          {g.rows.map((t) => {
            const v = describeTransactionRow(
              { ...t, splitCount: t.splits.length, categoryKind: t.categoryKind },
              defaultCurrency,
            );
            const account = accountsById[t.accountId];
            const category = t.categoryId ? categoryById.get(t.categoryId) : undefined;
            const splitCats = t.splits.length > 1 ? t.splits.map((sp) => categoryById.get(sp.categoryId)).filter(Boolean) : [];
            const isCursor = order[cursor] === t.id;
            const isChecked = checked.has(t.id);
            const display = t.merchantName ?? t.name;
            return (
              <div
                key={t.id}
                id={`txn-${t.id}`}
                role="row"
                aria-selected={isChecked}
                onClick={() => openTransaction(t.id)}
                className={cn(
                  "relative group grid grid-cols-[auto_minmax(0,1fr)_auto] lg:grid-cols-[20px_28px_minmax(180px,1fr)_minmax(150px,200px)_130px_70px_110px] gap-x-3 gap-y-1 items-center px-4 py-2.5 border-b border-border cursor-pointer",
                  isChecked ? "bg-brand-subtle" : "hover:bg-surface-2",
                  isCursor && "outline outline-2 -outline-offset-2 outline-info",
                )}
              >
                <button
                  type="button"
                  aria-label={isChecked ? "Deselect" : "Select"}
                  onClick={(e) => {
                    e.stopPropagation();
                    toggle(t.id);
                  }}
                  className={cn("hidden lg:block w-4 h-4 rounded-[4px] border", isChecked ? "bg-brand border-brand" : "border-border-strong opacity-60 group-hover:opacity-100")}
                />
                <span className="w-7 h-7 rounded-[8px] bg-sunken text-text-2 flex items-center justify-center text-xs font-medium flex-none">{display.charAt(0).toUpperCase()}</span>
                <span className="flex flex-col gap-0.5 min-w-0">
                  <span className="flex items-center gap-1.5 min-w-0">
                    {v.needsReview && <span className="w-2 h-2 rounded-full bg-brand flex-none" title="Needs review" />}
                    {v.recurring && <RefreshCw size={12} className="text-text-3 flex-none" aria-label="Recurring" />}
                    <span className={cn("text-[14.5px] truncate", v.amountTone === "muted" ? "text-text-2" : "text-text")}>{display}</span>
                    {v.mark && (
                      <span className={cn("flex-none text-[11px]", v.mark.kind === "pending" ? "italic text-text-3" : "px-1.5 py-px rounded-full bg-sunken text-text-3")}>{v.mark.text}</span>
                    )}
                  </span>
                  <span className="lg:hidden flex items-center gap-1.5 text-xs text-text-3 min-w-0">
                    <CategoryChip t={t} category={category} splitCats={splitCats} uncategorized={v.uncategorized} transfer={t.isTransfer} onOpen={() => setPickerFor(t.id)} />
                    <span className="truncate">{account?.name}</span>
                  </span>
                </span>
                <span className="hidden lg:flex relative min-w-0">
                  <CategoryChip t={t} category={category} splitCats={splitCats} uncategorized={v.uncategorized} transfer={t.isTransfer} onOpen={() => setPickerFor(t.id)} />
                </span>
                <span className="hidden lg:block text-[12.5px] text-text-3 truncate">{account?.name ?? "—"}</span>
                <span className="hidden lg:block text-[11px] text-text-3">{v.sourceLabel}</span>
                <span className={cn("text-right tabular text-[14.5px] font-medium", v.amountTone === "positive" ? "text-positive" : v.amountTone === "muted" ? "text-text-3" : "text-text", v.struck && "line-through")}>
                  {formatCents(t.amount, { signed: true })}
                </span>
                {pickerFor === t.id && (
                  <CategoryPicker
                    className="absolute left-12 top-full -mt-1"
                    categories={categories}
                    selectedId={t.categoryId}
                    onPick={(categoryId) => void bulk([t.id], { type: "setCategory", categoryId })}
                    onClose={() => setPickerFor(null)}
                  />
                )}
              </div>
            );
          })}
        </section>
      ))}

      {checked.size > 0 && (
        <div className="sticky bottom-3 z-20 mx-auto w-max max-w-full flex flex-wrap items-center gap-2 rounded-card border border-border bg-raised shadow-overlay px-3 py-2 text-[13.5px]">
          <span className="px-1 text-text">
            <b>{checked.size} selected</b> · <span className="tabular text-text-2">{formatCents(checkedTotal, { signed: true })}</span>
          </span>
          <span className="relative">
            <button type="button" disabled={busy} onClick={() => setPickerFor("bulk")} className="h-8 px-3 rounded-full bg-brand-subtle text-brand font-medium">
              Set category <span className="text-[11px] opacity-70">c</span>
            </button>
            {pickerFor === "bulk" && (
              <CategoryPicker className="absolute bottom-full mb-2 left-0" categories={categories} onPick={(categoryId) => void bulk([...checked], { type: "setCategory", categoryId })} onClose={() => setPickerFor(null)} />
            )}
          </span>
          <button type="button" disabled={busy} onClick={() => void bulk([...checked], { type: "markReviewed" })} className="h-8 px-3 rounded-full bg-brand-subtle text-brand font-medium">
            Mark reviewed <span className="text-[11px] opacity-70">e</span>
          </button>
          <button type="button" disabled={busy} onClick={() => void bulk([...checked], { type: "exclude", value: !checkedRows.every((r) => r.excludedFromBudget) })} className="h-8 px-3 rounded-full bg-brand-subtle text-brand font-medium">
            {checkedRows.every((r) => r.excludedFromBudget) ? "Include" : "Exclude"}
          </button>
          <button type="button" onClick={() => setChecked(new Set())} className="h-8 px-2 text-text-3 text-xs">
            Esc
          </button>
        </div>
      )}

      <TransactionDetailPanel transaction={selected ? toDetail(selected) : null} categories={categories} onClose={() => openTransaction(null)} onNavigate={navigate} />
    </>
  );
}

function CategoryChip({
  t,
  category,
  splitCats,
  uncategorized,
  transfer,
  onOpen,
}: {
  t: TransactionRowData;
  category: DetailCategoryOption | undefined;
  splitCats: (DetailCategoryOption | undefined)[];
  uncategorized: boolean;
  transfer: boolean;
  onOpen: () => void;
}) {
  if (transfer) return <span className="text-xs text-text-3">Not counted in spend</span>;
  if (splitCats.length > 1) {
    return (
      <span className="flex items-center gap-1 min-w-0">
        {splitCats.slice(0, 2).map((c) => (
          <span key={c!.id} className="inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-2 py-0.5 text-xs text-text-2 truncate">
            <span className="w-1.5 h-1.5 rounded-full flex-none" style={{ background: `var(--series-${c!.colorSlot})` }} />
            {c!.name}
          </span>
        ))}
      </span>
    );
  }
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onOpen();
      }}
      title="Change category"
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs truncate max-w-full",
        uncategorized ? "border border-dashed border-warning text-warning" : "bg-surface-2 text-text-2 hover:bg-raised-hover hover:text-text",
      )}
    >
      {!uncategorized && <span className="w-1.5 h-1.5 rounded-full flex-none" style={{ background: category ? `var(--series-${category.colorSlot})` : "var(--text-3)" }} />}
      <span className="truncate">{uncategorized ? "Choose category" : (category?.name ?? prettifyPfc(t.pfcDetailed))}</span>
    </button>
  );
}
