"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronDown, ChevronLeft, ChevronRight, X } from "lucide-react";
import { SidePanel } from "@/components/ui/SidePanel";
import { CategoryPicker } from "@/components/transactions/CategoryPicker";
import { MerchantAvatar } from "@/components/transactions/MerchantAvatar";
import { formatCents } from "@tally/core/money";
import { describeTransactionDetail, splitBalance, splitEvenly, spreadMonthly } from "@tally/core/transactionView";
import { cn } from "@/lib/cn";

export interface DetailCategoryOption {
  id: string;
  name: string;
  colorSlot: number;
  indent?: boolean;
}

export interface DetailSplit {
  categoryId: string;
  amount: number; // cents, positive
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
  isTransfer: boolean;
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
  isManual: boolean;
  recurringStreamId: string | null;
  /** Split term (3/6/9/12 months) of the stream this charge is spread by; null when it isn't. */
  amortizeMonths: number | null;
  splits: DetailSplit[];
  logoUrl?: string | null;
}

interface Suggestion {
  categoryId: string;
  name: string;
  colorSlot: number;
}

type Patch = { categoryId?: string | null; notes?: string | null; tags?: string[]; excluded?: boolean; reviewed?: boolean; splits?: DetailSplit[]; alwaysCategorizeMerchant?: boolean };

const TERMS = [3, 6, 9, 12] as const;
const NOTE_DEBOUNCE_MS = 600;
const TOAST_MS = 5000;

function longDate(dateStr: string): string {
  return new Date(dateStr + "T00:00:00Z").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

function dot(colorSlot: number | undefined) {
  return <span className="w-2 h-2 rounded-full flex-none" style={{ background: colorSlot ? `var(--series-${colorSlot})` : "var(--text-3)" }} />;
}

/**
 * The transaction edit panel: category first (with who set it, up to three
 * suggestions and the merchant rule), then how it counts (excluded, split,
 * spread), note and tags, and folded-away details. Every change saves on
 * its own with an Undo toast; only Split, which must add up first, has a
 * Save. Which blocks apply comes from @tally/core/transactionView's
 * describeTransactionDetail -- the same rules the mobile sheet renders.
 */
export function TransactionDetailPanel({
  transaction,
  categories,
  onClose,
  onNavigate,
}: {
  transaction: TransactionDetailData | null;
  categories: DetailCategoryOption[];
  onClose: () => void;
  /** Move to the next (1) or previous (-1) transaction without closing. */
  onNavigate?: (dir: 1 | -1) => void;
}) {
  const router = useRouter();
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [reviewed, setReviewed] = useState(false);
  const [excluded, setExcluded] = useState(false);
  const [notes, setNotes] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [rulePreview, setRulePreview] = useState<number | null>(null);
  const [ruleMade, setRuleMade] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [view, setView] = useState<"main" | "split" | "spread">("main");
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [retry, setRetry] = useState<(() => void) | null>(null);
  const [toast, setToast] = useState<{ text: string; undo?: () => void } | null>(null);
  const noteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedNotes = useRef("");

  const id = transaction?.id ?? null;

  // A different transaction resets everything; a refresh of the same one
  // (after a save) leaves what's on screen alone.
  useEffect(() => {
    if (!transaction) return;
    setCategoryId(transaction.categoryId);
    setReviewed(transaction.reviewed);
    setExcluded(transaction.excludedFromBudget);
    setNotes(transaction.notes ?? "");
    savedNotes.current = transaction.notes ?? "";
    setTags(transaction.tags);
    setTagInput(null);
    setSuggestions([]);
    setRulePreview(null);
    setRuleMade(false);
    setPickerOpen(false);
    setView("main");
    setDetailsOpen(false);
    setConfirmDelete(false);
    setStatus("idle");
    setRetry(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Suggestions (current category, then this merchant's past picks) and how
  // many past transactions a merchant rule would change.
  useEffect(() => {
    if (!transaction) return;
    let cancelled = false;
    fetch(`/api/transactions/${transaction.id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => !cancelled && d?.suggestions && setSuggestions(d.suggestions))
      .catch(() => {});
    if (transaction.merchantName && !transaction.isTransfer) {
      fetch("/api/rules?preview=1", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ match: { field: "merchant", op: "equals", value: transaction.merchantName } }),
      })
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => !cancelled && typeof d?.previewCount === "number" && setRulePreview(d.previewCount))
        .catch(() => {});
    }
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), TOAST_MS);
    return () => clearTimeout(t);
  }, [toast]);

  const patch = useCallback(
    async (body: Patch, opts?: { undo?: Patch; toast?: string; onUndo?: () => void }): Promise<boolean> => {
      if (!id) return false;
      setStatus("saving");
      setRetry(null);
      try {
        const res = await fetch(`/api/transactions/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
        if (!res.ok) throw new Error("Save failed");
        setStatus("saved");
        router.refresh();
        if (opts?.toast) {
          const undoBody = opts.undo;
          setToast({
            text: opts.toast,
            undo: undoBody
              ? () => {
                  opts.onUndo?.();
                  void patch(undoBody);
                }
              : undefined,
          });
        }
        return true;
      } catch {
        setStatus("error");
        setRetry(() => () => void patch(body, opts));
        return false;
      }
    },
    [id, router],
  );

  const nameOf = useCallback((cid: string | null) => categories.find((c) => c.id === cid)?.name ?? "Uncategorized", [categories]);

  function pickCategory(next: string | null) {
    setPickerOpen(false);
    if (!transaction) return;
    const prev = { categoryId, reviewed };
    setCategoryId(next);
    setReviewed(true);
    setRuleMade(false);
    void patch(
      { categoryId: next, reviewed: true },
      {
        undo: { categoryId: prev.categoryId, reviewed: prev.reviewed },
        toast: next === prev.categoryId ? "Marked reviewed" : `Category set to ${nameOf(next)}`,
        onUndo: () => {
          setCategoryId(prev.categoryId);
          setReviewed(prev.reviewed);
        },
      },
    );
  }

  function toggleReviewed() {
    const next = !reviewed;
    setReviewed(next);
    void patch({ reviewed: next }, { undo: { reviewed: !next }, toast: next ? "Marked reviewed" : "Marked not reviewed", onUndo: () => setReviewed(!next) });
  }

  function setExcludedTo(next: boolean) {
    if (next === excluded) return;
    setExcluded(next);
    void patch({ excluded: next }, { undo: { excluded: !next }, toast: next ? "Excluded from spend" : "Counts in spend again", onUndo: () => setExcluded(!next) });
  }

  async function makeRule() {
    if (!categoryId) return;
    const ok = await patch({ categoryId, alwaysCategorizeMerchant: true });
    if (ok) setRuleMade(true);
  }

  function onNotesChange(value: string) {
    setNotes(value);
    if (noteTimer.current) clearTimeout(noteTimer.current);
    noteTimer.current = setTimeout(() => flushNotes(value), NOTE_DEBOUNCE_MS);
  }

  function flushNotes(value = notes) {
    if (noteTimer.current) clearTimeout(noteTimer.current);
    const next = value.trim();
    if (next === savedNotes.current.trim()) return;
    savedNotes.current = next;
    void patch({ notes: next || null });
  }

  function saveTags(next: string[], text: string) {
    const prev = tags;
    setTags(next);
    void patch({ tags: next }, { undo: { tags: prev }, toast: text, onUndo: () => setTags(prev) });
  }

  function addTag() {
    const t = (tagInput ?? "").trim();
    setTagInput(null);
    if (!t || tags.includes(t)) return;
    saveTags([...tags, t], `Tagged ${t}`);
  }

  async function deleteTransaction() {
    if (!id) return;
    setStatus("saving");
    try {
      const res = await fetch(`/api/transactions/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      router.refresh();
      onClose();
    } catch {
      setStatus("error");
      setRetry(() => () => void deleteTransaction());
    }
  }

  // j/k move, e reviewed, c category, 1-3 pick a suggestion. Ignored while typing.
  useEffect(() => {
    if (!transaction) return;
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT" || target.isContentEditable)) return;
      if (e.metaKey || e.ctrlKey || e.altKey || view !== "main" || pickerOpen) return;
      if (e.key === "j" || e.key === "ArrowDown") {
        e.preventDefault();
        flushNotes();
        onNavigate?.(1);
      } else if (e.key === "k" || e.key === "ArrowUp") {
        e.preventDefault();
        flushNotes();
        onNavigate?.(-1);
      } else if (e.key === "e") {
        toggleReviewed();
      } else if (e.key === "c" && !transaction!.isTransfer) {
        e.preventDefault();
        setPickerOpen(true);
      } else if (["1", "2", "3"].includes(e.key) && !transaction!.isTransfer) {
        const s = suggestions[Number(e.key) - 1];
        if (s) pickCategory(s.categoryId);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (!transaction) return null;

  const v = describeTransactionDetail({ ...transaction, amortizeMonths: transaction.amortizeMonths });
  const current = categories.find((c) => c.id === categoryId);
  const display = transaction.merchantName ?? transaction.name;
  const splitNames = transaction.splits.map((s) => nameOf(s.categoryId));

  function close() {
    flushNotes();
    onClose();
  }

  return (
    <SidePanel open onClose={close}>
      <div className="flex flex-col gap-5 p-5 min-h-full">
        {view === "split" ? (
          <SplitView transaction={transaction} categories={categories} defaultCategoryId={categoryId} onBack={() => setView("main")} onSave={async (splits) => {
            const prev = transaction.splits;
            const ok = await patch({ splits }, { undo: { splits: prev }, toast: splits.length ? `Split across ${splits.length} categories` : "Split removed" });
            if (ok) setView("main");
          }} saving={status === "saving"} />
        ) : view === "spread" ? (
          <SpreadView transaction={transaction} months={v.spreadMonths} onBack={() => setView("main")} onDone={(text) => {
            setToast({ text });
            router.refresh();
            setView("main");
          }} />
        ) : (
          <>
            <div className="flex items-center justify-between">
              <SaveStatus status={status} retry={retry} />
              <div className="flex items-center gap-1 text-text-3">
                {onNavigate && (
                  <>
                    <button type="button" onClick={() => { flushNotes(); onNavigate(-1); }} className="w-8 h-8 rounded-control hover:bg-surface-2 flex items-center justify-center" aria-label="Previous transaction" title="Previous (k)">
                      <ChevronLeft size={16} />
                    </button>
                    <button type="button" onClick={() => { flushNotes(); onNavigate(1); }} className="w-8 h-8 rounded-control hover:bg-surface-2 flex items-center justify-center" aria-label="Next transaction" title="Next (j)">
                      <ChevronRight size={16} />
                    </button>
                  </>
                )}
                <button type="button" onClick={close} className="w-8 h-8 rounded-control hover:bg-surface-2 flex items-center justify-center" aria-label="Close" title="Close (Esc)">
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Header */}
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <MerchantAvatar name={display} logoUrl={transaction.logoUrl} className="w-10 h-10 rounded-[11px] bg-surface-2 font-semibold text-[15px]" />
                <div className="flex flex-col gap-0.5 min-w-0">
                  <span className="text-[16px] font-semibold text-text truncate">{display}</span>
                  <span className="text-[12.5px] text-text-3 truncate">
                    {longDate(transaction.postedDate)} · {transaction.accountName}
                    {transaction.accountMask ? ` ••${transaction.accountMask}` : ""}
                  </span>
                </div>
              </div>
              <div className="flex items-end justify-between gap-3">
                <span className={cn("font-display text-[40px] leading-none tabular money", v.amountTone === "positive" ? "text-positive" : v.amountTone === "muted" ? "text-text-2" : "text-text")}>
                  {formatCents(transaction.amount, { signed: true })}
                </span>
                <button
                  type="button"
                  onClick={toggleReviewed}
                  title="Toggle reviewed (e)"
                  className={cn("h-8 px-3.5 rounded-full text-[12.5px] font-semibold flex-none", reviewed ? "bg-surface-2 text-text-2" : "bg-brand-subtle text-brand")}
                >
                  {reviewed ? "✓ Reviewed" : "Mark reviewed"}
                </button>
              </div>
            </div>

            {v.notice && (
              <div className="rounded-control border border-border bg-sunken px-3.5 py-2.5 text-[13px] leading-snug text-text-2">
                <span className="block font-semibold text-text">{v.notice.title}</span>
                {v.notice.body}
              </div>
            )}

            {v.isInstallment && (
              <div className="rounded-control border border-border bg-sunken px-3.5 py-2.5 text-[13px] leading-snug text-text-2">
                <span className="block font-semibold text-text">One month of a spread plan</span>
                Change or stop the spread from the original charge.
              </div>
            )}

            {/* Category */}
            {v.canCategorize && !v.isInstallment && (
              <Group label="Category" hint="c">
                <div className="relative rounded-card bg-surface-2 p-3.5 flex flex-col gap-3">
                  <div className="flex items-center gap-3">
                    <span
                      className="w-[30px] h-[30px] rounded-[9px] flex items-center justify-center flex-none"
                      style={{ background: current ? `color-mix(in srgb, var(--series-${current.colorSlot}) 16%, transparent)` : "var(--sunken)" }}
                    >
                      {dot(current?.colorSlot)}
                    </span>
                    <span className="flex flex-col min-w-0 flex-1">
                      <span className={cn("text-[15px] font-semibold truncate", current ? "text-text" : "text-warning")}>{transaction.splits.length > 1 ? `Split · ${splitNames.join(", ")}` : (current?.name ?? "Choose a category")}</span>
                      <span className="text-[12px] text-text-3">{transaction.splits.length > 1 ? "Edit the split below" : (categoryId === transaction.categoryId ? v.sourceText : "Set by you") ?? "Not categorized yet"}</span>
                    </span>
                    {transaction.splits.length <= 1 && (
                      <button type="button" onClick={() => setPickerOpen((o) => !o)} className="text-[13px] font-semibold text-brand">
                        Change
                      </button>
                    )}
                  </div>
                  {pickerOpen && (
                    <CategoryPicker className="absolute left-3 right-3 top-14 z-10" categories={categories} selectedId={categoryId} onPick={(cid) => pickCategory(cid)} onClose={() => setPickerOpen(false)} />
                  )}
                  {suggestions.length > 0 && transaction.splits.length <= 1 && (
                    <div className="flex flex-wrap gap-1.5">
                      {suggestions.map((s, i) => {
                        const on = s.categoryId === categoryId;
                        return (
                          <button
                            key={s.categoryId}
                            type="button"
                            onClick={() => pickCategory(s.categoryId)}
                            title={`Press ${i + 1}`}
                            className={cn("inline-flex items-center gap-1.5 h-7 pl-2 pr-2.5 rounded-full text-[12.5px]", on ? "bg-brand-subtle text-brand font-medium" : "bg-surface text-text-2 hover:text-text")}
                          >
                            {dot(s.colorSlot)}
                            {s.name}
                            {on && !reviewed ? " ✓" : ""}
                          </button>
                        );
                      })}
                    </div>
                  )}
                  {transaction.merchantName && transaction.splits.length <= 1 && (
                    <div className="pt-3 border-t border-border text-[12.5px] leading-snug text-text-2">
                      {ruleMade ? (
                        <span>
                          <b className="text-text font-semibold">{transaction.merchantName}</b> now always goes to <b className="text-text font-semibold">{current?.name}</b>.{" "}
                          <Link href="/rules" className="text-brand font-medium">
                            Edit in Rules
                          </Link>
                        </span>
                      ) : (
                        <label className={cn("flex items-start gap-2.5", categoryId ? "cursor-pointer" : "opacity-50")}>
                          <input type="checkbox" className="sr-only peer" checked={false} disabled={!categoryId || status === "saving"} onChange={() => void makeRule()} />
                          <span className="relative flex-none mt-px w-8 h-[18px] rounded-full bg-border-strong peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-info">
                            <span className="absolute left-0.5 top-0.5 w-[14px] h-[14px] rounded-full bg-surface" />
                          </span>
                          <span>
                            Always use <b className="text-text font-semibold">{current?.name ?? "this category"}</b> for <b className="text-text font-semibold">{transaction.merchantName}</b>.
                            {rulePreview != null && ` Changes ${rulePreview} past transaction${rulePreview === 1 ? "" : "s"}.`}
                          </span>
                        </label>
                      )}
                    </div>
                  )}
                </div>
              </Group>
            )}

            {/* How it counts */}
            {!transaction.isTransfer && !v.isInstallment && (
              <Group label="How it counts">
                <div className="grid grid-cols-2 gap-1 rounded-control bg-surface p-1" role="radiogroup" aria-label="How it counts">
                  {[false, true].map((x) => (
                    <button
                      key={String(x)}
                      type="button"
                      role="radio"
                      aria-checked={excluded === x}
                      onClick={() => setExcludedTo(x)}
                      className={cn("h-8 rounded-[7px] text-[13px] font-medium", excluded === x ? "bg-surface-2 text-text" : "text-text-3 hover:text-text-2")}
                    >
                      {x ? "Excluded" : "Counts in spend"}
                    </button>
                  ))}
                </div>
                <div className="rounded-card bg-surface-2">
                  {v.canSplit && (
                    <RowButton label="Split across categories" value={transaction.splits.length > 1 ? `${transaction.splits.length} categories` : "Not split"} onClick={() => setView("split")} />
                  )}
                  {v.canSpread && (
                    <RowButton
                      label="Spread a prepaid plan"
                      value={v.spreadMonths ? `${v.spreadMonths} months · ${formatCents(spreadMonthly(transaction.amount, v.spreadMonths))}/mo` : "Off"}
                      onClick={() => setView("spread")}
                    />
                  )}
                </div>
              </Group>
            )}

            {/* Note and tags */}
            <Group label="Note and tags">
              <textarea
                value={notes}
                onChange={(e) => onNotesChange(e.target.value)}
                onBlur={() => flushNotes()}
                rows={2}
                placeholder="Add a note"
                className="rounded-card bg-surface-2 border border-transparent focus:border-border-strong px-3.5 py-2.5 text-[14px] text-text resize-none outline-none"
              />
              <div className="flex items-center gap-1.5 flex-wrap">
                {tags.map((t) => (
                  <button key={t} type="button" onClick={() => saveTags(tags.filter((x) => x !== t), `Removed ${t}`)} className="h-7 px-2.5 rounded-full bg-surface-2 text-[12.5px] text-text-2 hover:text-negative" title="Remove tag">
                    {t} ×
                  </button>
                ))}
                {tagInput !== null ? (
                  <input
                    autoFocus
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") addTag();
                      if (e.key === "Escape") {
                        e.stopPropagation();
                        setTagInput(null);
                      }
                    }}
                    onBlur={addTag}
                    maxLength={40}
                    placeholder="Tag"
                    className="h-7 w-24 rounded-full bg-surface-2 border border-border-strong px-2.5 text-[12.5px] text-text outline-none"
                  />
                ) : (
                  <button type="button" onClick={() => setTagInput("")} className="h-7 px-2.5 rounded-full border border-dashed border-border-strong text-[12.5px] text-text-3">
                    + Tag
                  </button>
                )}
              </div>
            </Group>

            {/* Details */}
            <div className="mt-auto pt-3 border-t border-border flex flex-col gap-3">
              <button type="button" onClick={() => setDetailsOpen((o) => !o)} className="flex items-center justify-between text-[12.5px] text-text-3 hover:text-text-2" aria-expanded={detailsOpen}>
                Details
                <ChevronDown size={14} className={cn("transition-transform motion-reduce:transition-none", detailsOpen && "rotate-180")} />
              </button>
              {detailsOpen && (
                <div className="flex flex-col gap-2 rounded-card bg-sunken p-3.5 text-[12.5px]">
                  <DetailRow label="Original description" value={transaction.name} mono />
                  <DetailRow label="Account" value={`${transaction.accountName}${transaction.accountMask ? ` ••${transaction.accountMask}` : ""}`} />
                  <DetailRow label="Status" value={transaction.isPending ? "Pending" : "Posted"} />
                  {transaction.locationLabel && <DetailRow label="Location" value={transaction.locationLabel} />}
                  <DetailRow label="ID" value={transaction.plaidTransactionId ?? transaction.id} mono copy />
                  {transaction.plaidItemLabel && <DetailRow label="Connection" value={transaction.plaidItemLabel} />}
                </div>
              )}
              {v.canDelete &&
                (confirmDelete ? (
                  <div className="rounded-card border border-border bg-sunken p-3.5 flex flex-col gap-3 text-[13px] text-text-2">
                    <span>
                      <b className="block text-text font-semibold">Delete {display}?</b>
                      It comes out of your spend. This can&apos;t be undone.
                    </span>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => setConfirmDelete(false)} className="flex-1 h-8 rounded-full border border-border-strong text-text font-semibold text-[12.5px]">
                        Keep it
                      </button>
                      <button type="button" onClick={() => void deleteTransaction()} disabled={status === "saving"} className="flex-1 h-8 rounded-full bg-negative text-on-brand font-semibold text-[12.5px] disabled:opacity-50">
                        Delete
                      </button>
                    </div>
                  </div>
                ) : (
                  <button type="button" onClick={() => setConfirmDelete(true)} className="self-start text-[13px] font-medium text-negative">
                    Delete transaction
                  </button>
                ))}
            </div>
          </>
        )}
      </div>

      {toast && (
        <div role="status" className="fixed right-6 bottom-6 z-[60] flex items-center gap-4 rounded-control bg-raised border border-border shadow-overlay px-4 py-2.5 text-[13.5px] text-text">
          {toast.text}
          {toast.undo && (
            <button
              type="button"
              className="text-brand font-medium"
              onClick={() => {
                toast.undo!();
                setToast(null);
              }}
            >
              Undo
            </button>
          )}
        </div>
      )}
    </SidePanel>
  );
}

function SaveStatus({ status, retry }: { status: "idle" | "saving" | "saved" | "error"; retry: (() => void) | null }) {
  if (status === "error") {
    return (
      <span className="text-[12px] text-negative">
        Couldn&apos;t save.{" "}
        {retry && (
          <button type="button" onClick={retry} className="font-semibold underline">
            Retry
          </button>
        )}
      </span>
    );
  }
  if (status === "idle") return <span className="text-xs font-medium uppercase tracking-wide text-text-3">Transaction</span>;
  return (
    <span className="flex items-center gap-1.5 text-[12px] text-text-3" aria-live="polite">
      <span className={cn("w-1.5 h-1.5 rounded-full", status === "saving" ? "bg-text-3" : "bg-positive")} />
      {status === "saving" ? "Saving…" : "Saved"}
    </span>
  );
}

function Group({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="m-0 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-text-3">
        {label}
        {hint && <kbd className="font-mono text-[10px] normal-case tracking-normal px-1.5 rounded border border-border bg-sunken text-text-2">{hint}</kbd>}
      </h3>
      {children}
    </section>
  );
}

function RowButton({ label, value, onClick }: { label: string; value: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="w-full flex items-center gap-2 px-3.5 py-3 text-left text-[13.5px] border-t border-border first:border-t-0 hover:bg-surface rounded-card">
      <span className="flex-1 text-text-2">{label}</span>
      <span className="text-text tabular">{value}</span>
      <ChevronRight size={14} className="text-text-3" />
    </button>
  );
}

function DetailRow({ label, value, mono, copy }: { label: string; value: string; mono?: boolean; copy?: boolean }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-text-3 flex-none">{label}</span>
      <span className={cn("text-text text-right break-all", mono && "font-mono text-[11.5px] text-text-2")}>
        {value}
        {copy && (
          <button
            type="button"
            className="ml-2 text-brand font-sans text-[11.5px] font-medium"
            onClick={() => {
              navigator.clipboard
                ?.writeText(value)
                .then(() => {
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                })
                .catch(() => {});
            }}
          >
            {copied ? "Copied" : "Copy"}
          </button>
        )}
      </span>
    </div>
  );
}

function BackBar({ title, onBack, right }: { title: string; onBack: () => void; right?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <button type="button" onClick={onBack} className="flex items-center gap-1 text-[13px] font-medium text-brand">
        <ChevronLeft size={15} /> Back
      </button>
      <span className="text-[14px] font-semibold text-text">{title}</span>
      <span className="min-w-[48px] flex justify-end">{right}</span>
    </div>
  );
}

/** Split lines must add up to the transaction before Save turns on. */
function SplitView({
  transaction,
  categories,
  defaultCategoryId,
  onBack,
  onSave,
  saving,
}: {
  transaction: TransactionDetailData;
  categories: DetailCategoryOption[];
  defaultCategoryId: string | null;
  onBack: () => void;
  onSave: (splits: DetailSplit[]) => void;
  saving: boolean;
}) {
  const total = Math.abs(transaction.amount);
  const [lines, setLines] = useState<{ categoryId: string | null; text: string }[]>(() =>
    transaction.splits.length > 1
      ? transaction.splits.map((s) => ({ categoryId: s.categoryId, text: (s.amount / 100).toFixed(2) }))
      : [
          { categoryId: defaultCategoryId, text: (total / 100).toFixed(2) },
          { categoryId: null, text: "0.00" },
        ],
  );
  const [lastEdited, setLastEdited] = useState(0);
  const [pickerFor, setPickerFor] = useState<number | null>(null);
  const cents = lines.map((l) => Math.round(parseFloat(l.text || "0") * 100) || 0);
  const bal = splitBalance(transaction.amount, cents);
  const allPicked = lines.every((l) => l.categoryId);
  const canSave = bal.balanced && allPicked && !saving;
  const byId = new Map(categories.map((c) => [c.id, c]));

  function update(i: number, patch: Partial<{ categoryId: string | null; text: string }>) {
    setLines(lines.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  }

  return (
    <>
      <BackBar
        title={`Split ${formatCents(total)}`}
        onBack={onBack}
        right={
          <button type="button" disabled={!canSave} onClick={() => onSave(lines.map((l, i) => ({ categoryId: l.categoryId!, amount: cents[i]! })))} className="text-[13px] font-semibold text-brand disabled:text-text-3">
            {saving ? "Saving…" : "Save"}
          </button>
        }
      />
      <div className="flex h-2 rounded-full overflow-hidden gap-0.5 bg-sunken" aria-hidden="true">
        {lines.map((l, i) => (
          <span key={i} style={{ flex: Math.max(0, cents[i]!), background: l.categoryId ? `var(--series-${byId.get(l.categoryId)?.colorSlot ?? 1})` : "var(--text-3)" }} />
        ))}
        {bal.remaining > 0 && <span className="opacity-50" style={{ flex: bal.remaining, background: "var(--warning)" }} />}
      </div>
      <div className="rounded-card bg-surface-2">
        {lines.map((l, i) => {
          const c = l.categoryId ? byId.get(l.categoryId) : undefined;
          return (
            <div key={i} className="relative flex items-center gap-2.5 px-3.5 py-2.5 border-t border-border first:border-t-0">
              <button type="button" onClick={() => setPickerFor(pickerFor === i ? null : i)} className={cn("flex-1 flex items-center gap-2 text-left text-[14px] min-w-0", c ? "text-text" : "text-warning")}>
                {c && dot(c.colorSlot)}
                <span className="truncate">{c?.name ?? "Choose category"}</span>
              </button>
              <input
                inputMode="decimal"
                value={l.text}
                onChange={(e) => {
                  update(i, { text: e.target.value.replace(/[^0-9.]/g, "") });
                  setLastEdited(i);
                }}
                aria-label={`Amount for ${c?.name ?? "line " + (i + 1)}`}
                className="w-24 h-8 rounded-control bg-sunken border border-border focus:border-brand px-2 text-right text-[14px] text-text tabular outline-none"
              />
              {lines.length > 2 && (
                <button type="button" onClick={() => setLines(lines.filter((_, j) => j !== i))} aria-label="Remove line" className="text-text-3 hover:text-negative">
                  <X size={14} />
                </button>
              )}
              {pickerFor === i && (
                <CategoryPicker className="absolute left-2 top-full z-10" categories={categories} selectedId={l.categoryId} onPick={(cid) => { update(i, { categoryId: cid }); setPickerFor(null); }} onClose={() => setPickerFor(null)} />
              )}
            </div>
          );
        })}
        <button type="button" onClick={() => setLines([...lines, { categoryId: null, text: (Math.max(0, bal.remaining) / 100).toFixed(2) }])} className="w-full px-3.5 py-2.5 border-t border-border text-left text-[13.5px] font-medium text-brand">
          + Add a category
        </button>
      </div>
      {bal.remaining !== 0 && (
        <div className="rounded-control border border-border bg-warning-subtle px-3.5 py-2.5 text-[13px] text-text-2">
          <b className="block text-warning font-semibold">{bal.remaining > 0 ? `${formatCents(bal.remaining)} left to assign` : `${formatCents(-bal.remaining)} more than the total`}</b>
          The lines have to add up to {formatCents(total)}.
        </div>
      )}
      <div className="flex gap-2">
        {bal.remaining > 0 && lines[lastEdited]?.categoryId && (
          <button
            type="button"
            onClick={() => update(lastEdited, { text: ((cents[lastEdited]! + bal.remaining) / 100).toFixed(2) })}
            className="flex-1 h-8 rounded-full bg-brand-subtle text-brand text-[12.5px] font-semibold truncate px-3"
          >
            Put the rest in {byId.get(lines[lastEdited]!.categoryId!)?.name}
          </button>
        )}
        <button
          type="button"
          onClick={() => {
            const even = splitEvenly(transaction.amount, lines.length);
            setLines(lines.map((l, i) => ({ ...l, text: (even[i]! / 100).toFixed(2) })));
          }}
          className="flex-1 h-8 rounded-full border border-border-strong text-text text-[12.5px] font-semibold"
        >
          Split evenly
        </button>
      </div>
      {transaction.splits.length > 1 && (
        <button type="button" onClick={() => onSave([])} disabled={saving} className="self-start text-[13px] font-medium text-negative">
          Remove the split
        </button>
      )}
    </>
  );
}

/** Spreading is confirmed with a preview; once on, the term can change or the spread can stop. */
function SpreadView({ transaction, months, onBack, onDone }: { transaction: TransactionDetailData; months: number | null; onBack: () => void; onDone: (text: string) => void }) {
  const [term, setTerm] = useState<number>(months ?? 12);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const monthly = spreadMonthly(transaction.amount, term);
  const start = new Date(transaction.postedDate + "T00:00:00Z");
  const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + term - 1, 1));
  const monthName = (d: Date) => d.toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });

  async function run(req: () => Promise<Response>, done: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await req();
      if (!res.ok) throw new Error("Failed");
      onDone(done);
    } catch {
      setError("Couldn't update the spread. Try again.");
    } finally {
      setBusy(false);
    }
  }

  const json = { "Content-Type": "application/json" };
  return (
    <>
      <BackBar title="Spread" onBack={onBack} />
      <div className="flex flex-col gap-0.5">
        <span className="text-[15px] font-semibold text-text">{transaction.merchantName ?? transaction.name}</span>
        <span className="text-[12.5px] text-text-3 tabular">
          {longDate(transaction.postedDate)} · {formatCents(transaction.amount, { signed: true })}
        </span>
      </div>
      <section className="flex flex-col gap-2">
        <h3 className="m-0 text-[11px] font-semibold uppercase tracking-wide text-text-3">It&apos;s paid every</h3>
        <div className="grid grid-cols-4 gap-1 rounded-control bg-surface p-1" role="radiogroup" aria-label="Term">
          {TERMS.map((m) => (
            <button key={m} type="button" role="radio" aria-checked={term === m} onClick={() => setTerm(m)} className={cn("h-8 rounded-[7px] text-[13px] font-medium", term === m ? "bg-surface-2 text-text" : "text-text-3 hover:text-text-2")}>
              {m} mo
            </button>
          ))}
        </div>
      </section>
      <div className="rounded-control border border-brand-border bg-brand-subtle px-3.5 py-3 text-[13px] leading-snug text-text-2">
        <b className="block text-brand font-semibold tabular">
          {formatCents(monthly)} a month, {monthName(start)} to {monthName(end)}
        </b>
        Each month&apos;s budget gets one share instead of the whole charge landing in one month.
      </div>
      {error && <span className="text-[13px] text-negative">{error}</span>}
      {months == null ? (
        <button
          type="button"
          disabled={busy}
          onClick={() => void run(() => fetch(`/api/transactions/${transaction.id}/mark-annual`, { method: "POST", headers: json, body: JSON.stringify({ months: term }) }), `Spread over ${term} months`)}
          className="h-10 rounded-full bg-brand text-on-brand text-[13.5px] font-semibold disabled:opacity-50"
        >
          {busy ? "Spreading…" : `Spread over ${term} months`}
        </button>
      ) : (
        <div className="flex flex-col gap-3">
          <button
            type="button"
            disabled={busy || term === months}
            onClick={() => void run(() => fetch(`/api/recurring-streams/${transaction.recurringStreamId}`, { method: "PATCH", headers: json, body: JSON.stringify({ amortizeMonths: term }) }), `Now spread over ${term} months`)}
            className="h-10 rounded-full bg-brand text-on-brand text-[13.5px] font-semibold disabled:opacity-40"
          >
            {term === months ? `Spread over ${months} months` : `Change to ${term} months`}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void run(() => fetch(`/api/recurring-streams/${transaction.recurringStreamId}`, { method: "PATCH", headers: json, body: JSON.stringify({ amortizeMonthly: false }) }), "Stopped spreading")}
            className="self-start text-[13px] font-medium text-negative"
          >
            Stop spreading
          </button>
        </div>
      )}
    </>
  );
}
