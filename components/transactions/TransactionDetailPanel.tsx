"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { SidePanel } from "@/components/ui/SidePanel";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { formatCents } from "@/lib/money";
import { cn } from "@/lib/cn";

export interface DetailCategoryOption {
  id: string;
  name: string;
  colorSlot: number;
}

export interface DetailSplit {
  categoryId: string;
  amount: number; // cents
  note?: string | null;
}

export interface TransactionDetailData {
  id: string;
  plaidTransactionId: string | null;
  merchantName: string | null;
  name: string;
  amount: number; // cents, signed
  currency: string;
  postedDate: string;
  isPending: boolean;
  categoryId: string | null;
  categorySource: string;
  notes: string | null;
  tags: string[];
  excludedFromBudget: boolean;
  reviewed: boolean;
  locationLabel: string | null;
  accountName: string;
  accountMask: string | null;
  plaidItemLabel: string | null;
  splits: DetailSplit[];
}

function formatDate(dateStr: string): string {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", { weekday: undefined, month: "short", day: "numeric", year: "numeric" });
}

export function TransactionDetailPanel({
  transaction,
  categories,
  onClose,
}: {
  transaction: TransactionDetailData | null;
  categories: DetailCategoryOption[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [categoryId, setCategoryId] = useState("");
  const [notes, setNotes] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [addingTag, setAddingTag] = useState(false);
  const [excluded, setExcluded] = useState(false);
  const [reviewed, setReviewed] = useState(false);
  const [alwaysCategorize, setAlwaysCategorize] = useState(false);
  const [previewCount, setPreviewCount] = useState<number | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [splits, setSplits] = useState<DetailSplit[]>([]);
  const [editingSplits, setEditingSplits] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!transaction) return;
    setCategoryId(transaction.categoryId ?? "");
    setNotes(transaction.notes ?? "");
    setTags(transaction.tags);
    setTagInput("");
    setAddingTag(false);
    setExcluded(transaction.excludedFromBudget);
    setReviewed(transaction.reviewed);
    setAlwaysCategorize(false);
    setPreviewCount(null);
    setSplits(transaction.splits);
    setEditingSplits(false);
  }, [transaction]);

  if (!transaction) return null;

  const current = categories.find((c) => c.id === categoryId);
  const initial = (transaction.merchantName ?? transaction.name).charAt(0).toUpperCase();

  async function toggleAlwaysCategorize(checked: boolean) {
    setAlwaysCategorize(checked);
    if (checked && transaction!.merchantName && previewCount === null) {
      setPreviewLoading(true);
      try {
        const res = await fetch("/api/rules?preview=1", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ match: { field: "merchant", op: "equals", value: transaction!.merchantName } }),
        });
        if (res.ok) {
          const data = await res.json();
          setPreviewCount(data.previewCount);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setPreviewLoading(false);
      }
    }
  }

  function addTag() {
    const t = tagInput.trim();
    if (t && !tags.includes(t)) setTags([...tags, t]);
    setTagInput("");
    setAddingTag(false);
  }

  function updateSplit(index: number, patch: Partial<DetailSplit>) {
    setSplits(splits.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  }

  function removeSplit(index: number) {
    setSplits(splits.filter((_, i) => i !== index));
  }

  function addSplitLine() {
    const allocated = splits.reduce((sum, s) => sum + s.amount, 0);
    const remaining = Math.abs(transaction!.amount) - allocated;
    setSplits([...splits, { categoryId: categoryId || categories[0]?.id || "", amount: Math.max(0, remaining) }]);
  }

  async function save() {
    setSaving(true);
    try {
      const res = await fetch(`/api/transactions/${transaction!.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          categoryId: categoryId || null,
          notes: notes.trim() || null,
          tags,
          excluded,
          reviewed,
          splits: editingSplits ? splits.map((s) => ({ categoryId: s.categoryId, amount: s.amount, note: s.note ?? null })) : undefined,
          alwaysCategorizeMerchant: alwaysCategorize,
        }),
      });
      if (!res.ok) throw new Error("Failed to save transaction");
      router.refresh();
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  }

  const splitTotal = splits.reduce((sum, s) => sum + s.amount, 0);
  const splitRemaining = Math.abs(transaction.amount) - splitTotal;

  return (
    <SidePanel open={Boolean(transaction)} onClose={onClose}>
      <div className="flex flex-col gap-5 p-5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium uppercase tracking-wide text-text-3">Transaction</span>
          <button onClick={onClose} aria-label="Close" className="text-text-3 hover:text-text text-lg leading-none">
            ×
          </button>
        </div>

        <div className="flex items-center gap-3">
          <span
            className="w-10 h-10 flex-none rounded-[10px] flex items-center justify-center font-semibold text-[15px]"
            style={{
              background: current ? `color-mix(in srgb, var(--series-${current.colorSlot}) 16%, transparent)` : "var(--sunken)",
              color: current ? `var(--series-${current.colorSlot})` : "var(--text-2)",
            }}
          >
            {initial}
          </span>
          <div className="flex flex-col gap-0.5 min-w-0">
            <span className="text-[17px] font-semibold text-text truncate">{transaction.merchantName ?? transaction.name}</span>
            <span className="text-[13px] text-text-3 truncate">
              {[current?.name, transaction.locationLabel].filter(Boolean).join(" · ") || "Uncategorized"}
            </span>
          </div>
        </div>

        <span className={cn("font-display text-4xl tabular money", transaction.amount < 0 ? "text-negative" : "text-positive")}>
          {formatCents(transaction.amount, { signed: true })}
        </span>

        <div className="h-px bg-border" />

        <div className="flex flex-col gap-2.5">
          <DetailRow label="Date" value={formatDate(transaction.postedDate)} />
          <DetailRow label="Account" value={`${transaction.accountName} ····${transaction.accountMask ?? "----"}`} />
          <DetailRow label="Status" value={transaction.isPending ? "Pending" : "Posted"} />
          <DetailRow label="Original description" value={transaction.name} mono />
          <DetailRow
            label="Reviewed"
            value={
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input type="checkbox" checked={reviewed} onChange={(e) => setReviewed(e.target.checked)} />
                <span className={reviewed ? "text-positive" : "text-text-2"}>{reviewed ? "Reviewed" : "Not yet"}</span>
              </label>
            }
          />
        </div>

        <div className="h-px bg-border" />

        <div className="flex flex-col gap-2">
          <span className="text-xs font-medium uppercase tracking-wide text-text-3">Category</span>
          <SearchableSelect
            value={categoryId}
            onChange={setCategoryId}
            buttonPlaceholder="Uncategorized"
            placeholder="Search categories…"
            options={[{ value: "", label: "Uncategorized" }, ...categories.map((c) => ({ value: c.id, label: c.name, colorSlot: c.colorSlot }))]}
          />

          {transaction.merchantName && (
            <label className="flex items-start gap-2.5 p-3 rounded-control bg-positive-subtle cursor-pointer">
              <span className="relative inline-flex items-center flex-none mt-0.5">
                <input
                  type="checkbox"
                  checked={alwaysCategorize}
                  onChange={(e) => toggleAlwaysCategorize(e.target.checked)}
                  className="peer sr-only"
                />
                <span className="w-8 h-[18px] rounded-full bg-border-strong peer-checked:bg-positive transition-colors" />
                <span className="absolute left-0.5 top-0.5 w-[14px] h-[14px] rounded-full bg-surface transition-transform peer-checked:translate-x-[14px]" />
              </span>
              <span className="text-[13.5px] text-text leading-snug">
                Always categorize <strong>{transaction.merchantName}</strong> as {current?.name ?? "this category"} —{" "}
                {previewLoading ? "checking…" : previewCount != null ? `applies to ${previewCount} past transaction${previewCount === 1 ? "" : "s"}.` : "applies going forward."}
              </span>
            </label>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-xs font-medium uppercase tracking-wide text-text-3">Note</span>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="Add a note…"
            className="rounded-control bg-surface-2 border border-border-strong px-3 py-2 text-[14px] text-text resize-none"
          />
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-xs font-medium uppercase tracking-wide text-text-3">Tags</span>
          <div className="flex items-center gap-2 flex-wrap">
            {tags.map((t) => (
              <button
                key={t}
                onClick={() => setTags(tags.filter((x) => x !== t))}
                className="h-6 px-2.5 rounded-full bg-surface-2 border border-border text-[13px] text-text-2 hover:text-negative"
              >
                {t} ×
              </button>
            ))}
            {addingTag ? (
              <input
                autoFocus
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addTag()}
                onBlur={addTag}
                className="h-6 w-20 rounded-full bg-surface-2 border border-border-strong px-2 text-[13px] text-text"
              />
            ) : (
              <button
                onClick={() => setAddingTag(true)}
                className="h-6 px-2.5 rounded-full border border-dashed border-border-strong text-[13px] text-text-3"
              >
                + tag
              </button>
            )}
          </div>
        </div>

        <label className="flex items-center gap-1.5 text-[13.5px] text-text-2">
          <input type="checkbox" checked={excluded} onChange={(e) => setExcluded(e.target.checked)} />
          Exclude from budget
        </label>

        <div className="h-px bg-border" />

        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wide text-text-3">Split</span>
            <button onClick={() => setEditingSplits(!editingSplits)} className="text-brand text-[13px]">
              {editingSplits ? "Done" : "Edit split"}
            </button>
          </div>

          {!editingSplits ? (
            splits.length === 0 ? (
              <span className="text-[13.5px] text-text-3">Not split.</span>
            ) : (
              splits.map((s, i) => (
                <div key={i} className="flex items-center justify-between text-[13.5px]">
                  <span className="text-text">{categories.find((c) => c.id === s.categoryId)?.name ?? "—"}</span>
                  <span className="text-text tabular money">{formatCents(-s.amount)}</span>
                </div>
              ))
            )
          ) : (
            <div className="flex flex-col gap-2">
              {splits.map((s, i) => (
                <div key={i} className="flex items-center gap-2">
                  <SearchableSelect
                    value={s.categoryId}
                    onChange={(v) => updateSplit(i, { categoryId: v })}
                    buttonPlaceholder="Choose category"
                    placeholder="Search categories…"
                    className="flex-1"
                    options={categories.map((c) => ({ value: c.id, label: c.name, colorSlot: c.colorSlot }))}
                  />
                  <input
                    type="number"
                    step="0.01"
                    value={(s.amount / 100).toFixed(2)}
                    onChange={(e) => updateSplit(i, { amount: Math.round(parseFloat(e.target.value || "0") * 100) })}
                    className="w-24 h-9 rounded-control bg-surface-2 border border-border-strong px-2 text-sm text-text tabular"
                  />
                  <button onClick={() => removeSplit(i)} className="text-text-3 hover:text-negative text-sm">
                    ×
                  </button>
                </div>
              ))}
              <button onClick={addSplitLine} className="text-brand text-[13px] w-fit">
                + Add split
              </button>
              <span className={cn("text-xs tabular money", splitRemaining === 0 ? "text-text-3" : "text-warning")}>
                {formatCents(splitRemaining)} unallocated
              </span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3 pt-1">
          <button
            onClick={save}
            disabled={saving}
            className="h-9 px-4 rounded-control bg-brand text-on-brand text-sm font-medium disabled:opacity-40"
          >
            {saving ? "Saving…" : "Save"}
          </button>
          <button onClick={onClose} className="h-9 px-4 rounded-control bg-surface border border-border-strong text-sm font-medium text-text hover:bg-sunken">
            Cancel
          </button>
        </div>

        <span className="font-mono text-[11px] text-text-3">
          {transaction.plaidTransactionId ?? transaction.id} {transaction.plaidItemLabel ? `· ${transaction.plaidItemLabel}` : ""}
        </span>
      </div>
    </SidePanel>
  );
}

function DetailRow({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-xs font-medium uppercase tracking-wide text-text-3 flex-none">{label}</span>
      <span className={cn("text-[13.5px] text-text text-right truncate", mono && "font-mono text-xs")}>{value}</span>
    </div>
  );
}
