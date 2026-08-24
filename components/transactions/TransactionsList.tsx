"use client";

import { useState } from "react";
import { formatCents } from "@/lib/money";
import { prettifyPfc } from "@/lib/pfc";
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
  splits: DetailSplit[];
}

export interface AccountLookup {
  name: string;
  mask: string | null;
  plaidItemLabel: string | null;
}

function amountColorClass(cents: number): string {
  if (cents > 0) return "text-positive";
  if (cents < 0) return "text-negative";
  return "text-text";
}

function relativeDate(dateStr: string): string {
  const date = new Date(dateStr + "T00:00:00");
  const now = new Date();
  const sameYear = date.getFullYear() === now.getFullYear();
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: sameYear ? undefined : "numeric" });
}

export function TransactionsList({
  rows,
  accountsById,
  categories,
}: {
  rows: TransactionRowData[];
  accountsById: Record<string, AccountLookup>;
  categories: DetailCategoryOption[];
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = rows.find((r) => r.id === selectedId) ?? null;

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
      splits: row.splits,
    };
  }

  return (
    <>
      {rows.map((t) => {
        const account = accountsById[t.accountId];
        const category = categories.find((c) => c.id === t.categoryId);
        const initial = (t.merchantName ?? t.name).charAt(0).toUpperCase();
        return (
          <button
            key={t.id}
            onClick={() => setSelectedId(t.id)}
            className="w-full flex flex-col gap-1.5 px-4 py-3 lg:grid lg:grid-cols-[92px_minmax(180px,1fr)_150px_170px_120px] lg:gap-3 lg:items-center lg:py-2.5 border-b border-border last:border-b-0 text-left hover:bg-surface-2 transition-colors"
          >
            {/* Mobile: merchant + amount on top, date/account/category condensed below. Desktop grid columns hidden here. */}
            <div className="flex items-center justify-between gap-3 lg:hidden">
              <span className="flex items-center gap-2.5 min-w-0">
                <span className="w-[26px] h-[26px] flex-none rounded-[7px] bg-sunken text-text-2 flex items-center justify-center text-xs font-medium">
                  {initial}
                </span>
                <span className="text-[15px] text-text truncate">{t.merchantName ?? t.name}</span>
                {t.isPending && (
                  <span className="flex-none px-1.5 py-0.5 rounded-full bg-warning-subtle text-warning text-[11px] font-medium uppercase tracking-wide">
                    Pending
                  </span>
                )}
                {t.isManual && (
                  <span className="flex-none px-1.5 py-0.5 rounded-full bg-sunken text-text-3 text-[11px] font-medium uppercase tracking-wide">
                    Manual
                  </span>
                )}
              </span>
              <span className={`text-right flex-none text-[15px] tabular money ${amountColorClass(t.amount)}`}>{formatCents(t.amount, { signed: true })}</span>
            </div>
            <div className="flex items-center gap-2 min-w-0 pl-[34px] lg:hidden">
              <span className="font-mono text-xs text-text-3 tabular flex-none">{relativeDate(t.postedDate)}</span>
              <span className="text-text-3 flex-none">·</span>
              <span
                className="w-1.5 h-1.5 rounded-full flex-none"
                style={{ background: category ? `var(--series-${category.colorSlot})` : "var(--text-3)" }}
              />
              <span className="text-xs text-text-3 truncate">{category?.name ?? prettifyPfc(t.pfcDetailed)}</span>
            </div>

            {/* Desktop grid columns */}
            <span className="hidden lg:inline font-mono text-[13.5px] text-text-2 tabular">{relativeDate(t.postedDate)}</span>
            <span className="hidden lg:flex items-center gap-2.5 min-w-0">
              <span className="w-[26px] h-[26px] flex-none rounded-[7px] bg-sunken text-text-2 flex items-center justify-center text-xs font-medium">
                {initial}
              </span>
              <span className="text-[15px] text-text truncate">{t.merchantName ?? t.name}</span>
              {t.isPending && (
                <span className="flex-none px-1.5 py-0.5 rounded-full bg-warning-subtle text-warning text-[11px] font-medium uppercase tracking-wide">
                  Pending
                </span>
              )}
              {t.isManual && (
                <span className="flex-none px-1.5 py-0.5 rounded-full bg-sunken text-text-3 text-[11px] font-medium uppercase tracking-wide">
                  Manual
                </span>
              )}
            </span>
            <span className="hidden lg:inline font-mono text-xs text-text-2 truncate">
              {account ? `${account.name} ····${account.mask ?? "----"}` : "—"}
            </span>
            <span className="hidden lg:flex items-center gap-1.5 min-w-0">
              <span
                className="w-1.5 h-1.5 rounded-full flex-none"
                style={{ background: category ? `var(--series-${category.colorSlot})` : "var(--text-3)" }}
              />
              <span className="text-[13px] text-text-2 truncate">{category?.name ?? prettifyPfc(t.pfcDetailed)}</span>
            </span>
            <span className={`hidden lg:inline text-right text-[15px] tabular money ${amountColorClass(t.amount)}`}>
              {formatCents(t.amount, { signed: true })}
            </span>
          </button>
        );
      })}

      <TransactionDetailPanel
        transaction={selected ? toDetail(selected) : null}
        categories={categories}
        onClose={() => setSelectedId(null)}
      />
    </>
  );
}
