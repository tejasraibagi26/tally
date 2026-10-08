"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { formatCents } from "@tally/core/money";
import { cn } from "@/lib/cn";
import { SidePanel } from "@/components/ui/SidePanel";
import { CategoryPicker } from "@/components/transactions/CategoryPicker";
import type { DetailCategoryOption } from "@/components/transactions/TransactionDetailPanel";

interface QueueItem {
  id: string;
  postedDate: string;
  merchantName: string | null;
  name: string;
  amount: number;
  accountName: string;
  categoryId: string | null;
  isPending: boolean;
  suggestions: { categoryId: string; name: string; colorSlot: number; reason: "current" | "history" }[];
}

/**
 * "Review N": one transaction at a time in a side panel. Enter confirms the
 * first suggestion, 1-3 pick a suggestion, O opens the full list, S skips.
 * "Always use … for <merchant>" turns the pick into a rule (PATCH
 * /api/transactions/:id alwaysCategorizeMerchant), so it won't come back.
 */
export function ReviewQueue({ categories, pendingCount }: { categories: DetailCategoryOption[]; pendingCount: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<QueueItem[] | null>(null);
  const [index, setIndex] = useState(0);
  const [done, setDone] = useState(0);
  const [always, setAlways] = useState(false);
  const [picking, setPicking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    setOpen(true);
    setItems(null);
    setIndex(0);
    setDone(0);
    setError(null);
    try {
      const res = await fetch("/api/transactions/review");
      if (!res.ok) throw new Error("Failed");
      const data: { items: QueueItem[] } = await res.json();
      setItems(data.items);
    } catch {
      setItems([]);
      setError("Couldn't load transactions to review.");
    }
  }

  const close = useCallback(() => {
    setOpen(false);
    if (done > 0) router.refresh();
  }, [done, router]);

  const current = items?.[index] ?? null;

  const resolve = useCallback(
    async (categoryId: string | null) => {
      if (!current || saving) return;
      setSaving(true);
      setError(null);
      try {
        const body: Record<string, unknown> = { reviewed: true };
        if (categoryId) {
          body.categoryId = categoryId;
          if (always && current.merchantName) body.alwaysCategorizeMerchant = true;
        }
        const res = await fetch(`/api/transactions/${current.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
        if (!res.ok) throw new Error("Failed");
        setDone((d) => d + 1);
        setIndex((i) => i + 1);
        setAlways(false);
        setPicking(false);
      } catch {
        setError("Couldn't save that one. Try again.");
      } finally {
        setSaving(false);
      }
    },
    [current, saving, always],
  );

  useEffect(() => {
    if (!open || !current || picking) return;
    function onKey(e: KeyboardEvent) {
      if ((e.target as HTMLElement)?.tagName === "INPUT") return;
      const n = Number(e.key);
      if (e.key === "Enter" && current!.suggestions[0]) {
        e.preventDefault();
        void resolve(current!.suggestions[0].categoryId);
      } else if (n >= 1 && n <= 3 && current!.suggestions[n - 1]) {
        void resolve(current!.suggestions[n - 1]!.categoryId);
      } else if (e.key === "o") {
        e.preventDefault();
        setPicking(true);
      } else if (e.key === "s") {
        setIndex((i) => i + 1);
        setAlways(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, current, picking, resolve]);

  if (pendingCount === 0 && !open) return null;
  const total = items?.length ?? pendingCount;
  const merchant = current ? (current.merchantName ?? current.name) : "";
  const first = current?.suggestions[0];

  return (
    <>
      <Button onClick={start}>Review {pendingCount}</Button>
      <SidePanel open={open} onClose={close}>
        <div className="flex flex-col gap-5 p-6 min-h-full">
          <div className="flex items-center justify-between">
            <h2 className="m-0 text-lg font-semibold text-text">{items == null ? "Loading…" : current ? `${Math.min(index + 1, total)} of ${total}` : "Review"}</h2>
            <button type="button" onClick={close} aria-label="Close" className="w-8 h-8 flex items-center justify-center rounded-control text-text-3 hover:text-text hover:bg-sunken">
              <X size={18} />
            </button>
          </div>
          {items != null && total > 0 && (
            <div className="h-1 rounded-full bg-sunken overflow-hidden">
              <div className="h-full bg-brand transition-[width]" style={{ width: `${(Math.min(index, total) / total) * 100}%` }} />
            </div>
          )}

          {items == null ? (
            <div className="h-40 rounded-card bg-sunken animate-pulse" />
          ) : !current ? (
            <div className="flex flex-col items-start gap-3 py-6">
              <h3 className="m-0 font-display text-[26px] font-normal text-text">{error ? "Something went wrong" : "You're all caught up"}</h3>
              <p className="m-0 text-[14px] text-text-2">{error ?? (done > 0 ? `${done} reviewed. New transactions show up here as they sync.` : "Nothing left to review.")}</p>
              <button type="button" onClick={close} className="h-9 px-4 rounded-full bg-brand text-on-brand text-[13.5px] font-semibold">
                Done
              </button>
            </div>
          ) : (
            <>
              <div className="rounded-card bg-surface border border-border p-5 flex flex-col gap-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex flex-col gap-1 min-w-0">
                    <span className="text-[17px] font-semibold text-text truncate">{merchant}</span>
                    <span className="text-xs text-text-3">
                      {new Date(`${current.postedDate}T00:00:00`).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })} · {current.accountName}
                      {current.isPending && " · pending"}
                    </span>
                  </div>
                  <span className={cn("tabular text-[19px] font-semibold", current.amount > 0 ? "text-positive" : "text-text")}>{formatCents(current.amount, { signed: true })}</span>
                </div>
                {current.suggestions.length > 0 && <span className="text-xs text-text-3">{first?.reason === "current" ? "Tally's guess" : "You've used"}</span>}
                <div className="flex flex-col gap-2">
                  {current.suggestions.map((s, i) => (
                    <button
                      key={s.categoryId}
                      type="button"
                      disabled={saving}
                      onClick={() => void resolve(s.categoryId)}
                      className={cn("h-10 px-4 rounded-full flex items-center justify-between text-[13.5px] font-medium disabled:opacity-60", i === 0 ? "bg-brand text-on-brand" : "bg-brand-subtle text-brand")}
                    >
                      <span className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full" style={{ background: `var(--series-${s.colorSlot})` }} />
                        {i === 0 ? `✓ ${s.name}` : s.name}
                      </span>
                      <span className="text-[11px] opacity-70">{i === 0 ? "Enter" : i + 1}</span>
                    </button>
                  ))}
                  <span className="relative">
                    <button type="button" onClick={() => setPicking(true)} className="w-full h-10 px-4 rounded-full border border-border text-text-2 text-[13.5px] flex items-center justify-between">
                      {current.suggestions.length ? "Other category…" : "Choose a category"} <span className="text-[11px] opacity-70">o</span>
                    </button>
                    {picking && <CategoryPicker className="absolute top-full mt-1 left-0" categories={categories} onPick={(id) => void resolve(id)} onClose={() => setPicking(false)} />}
                  </span>
                </div>
                {current.merchantName && (
                  <label className="flex items-center gap-2 text-[13px] text-text-2 cursor-pointer">
                    <input type="checkbox" checked={always} onChange={(e) => setAlways(e.target.checked)} className="accent-[var(--brand)]" />
                    Always use my pick for {current.merchantName}
                  </label>
                )}
              </div>
              {error && <span className="text-[13px] text-negative">{error}</span>}
              <div className="flex items-center justify-between text-xs text-text-3">
                <button type="button" onClick={() => void resolve(null)} disabled={saving} className="hover:text-text">
                  Looks right, mark reviewed
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIndex((i) => i + 1);
                    setAlways(false);
                  }}
                  className="hover:text-text"
                >
                  Skip <span className="opacity-70">s</span>
                </button>
              </div>
            </>
          )}
        </div>
      </SidePanel>
    </>
  );
}
