"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { formatCents } from "@tally/core/money";
import { monthLastDay } from "@tally/core/budgetMath";
import { cn } from "@/lib/cn";
import { SidePanel } from "@/components/ui/SidePanel";
import { Button } from "@/components/ui/Button";
import { InlineError } from "@/components/ui/InlineError";
import type { BudgetHistoryMonth, BudgetLine } from "@/lib/budgets";

function fmt(c: number) {
  return formatCents(c).replace(/\.00$/, "");
}

/**
 * One budget: this month, six months of history (to pick a realistic
 * amount), plain-language toggles, and Remove with undo -- replacing the
 * inline Edit / Remove links and raw checkboxes.
 */
export function BudgetPanel({
  month,
  line,
  onClose,
  onRemoved,
}: {
  month: string;
  line: BudgetLine | null;
  onClose: () => void;
  onRemoved: (undo: () => Promise<void>) => void;
}) {
  const router = useRouter();
  const [history, setHistory] = useState<BudgetHistoryMonth[] | null>(null);
  const [amountInput, setAmountInput] = useState("");
  const [rollover, setRollover] = useState(false);
  const [fixed, setFixed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const categoryId = line?.categoryId;
  useEffect(() => {
    if (!line) return;
    setAmountInput((line.amount / 100).toFixed(0));
    setRollover(line.rolloverEnabled);
    setFixed(line.isFixedAmount);
    setError(null);
    setHistory(null);
    let cancelled = false;
    fetch(`/api/budgets/history?categoryId=${line.categoryId}&month=${month}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => !cancelled && setHistory(d?.months ?? []))
      .catch(() => !cancelled && setHistory([]));
    return () => {
      cancelled = true;
    };
    // Re-seed only when a different budget opens, not on every refresh of the same one.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoryId, month]);

  if (!line) return null;
  const current = line;
  const amount = Math.round((parseFloat(amountInput) || 0) * 100);
  const dirty = amount !== current.amount || rollover !== current.rolloverEnabled || fixed !== current.isFixedAmount;
  const past = (history ?? []).slice(0, -1).filter((h) => h.spend > 0 || h.amount != null);
  const recent = past.slice(-3);
  const avg = recent.length ? Math.round(recent.reduce((s, h) => s + h.spend, 0) / recent.length) : null;
  const overCount = past.filter((h) => h.amount != null && h.spend > h.amount).length;
  const maxBar = Math.max(1, ...(history ?? []).map((h) => Math.max(h.spend, h.amount ?? 0)));

  async function put(body: { amount: number; rolloverEnabled: boolean; isFixedAmount: boolean }) {
    const res = await fetch("/api/budgets", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ month, categoryId: current.categoryId, ...body }) });
    if (!res.ok) throw new Error("Failed");
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      await put({ amount, rolloverEnabled: rollover, isFixedAmount: fixed });
      router.refresh();
    } catch {
      setError("Couldn't save. Try again.");
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    setSaving(true);
    try {
      const res = await fetch("/api/budgets", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ month, categoryId: current.categoryId }) });
      if (!res.ok) throw new Error("Failed");
      const snapshot = { amount: current.amount, rolloverEnabled: current.rolloverEnabled, isFixedAmount: current.isFixedAmount };
      router.refresh();
      onRemoved(() => put(snapshot));
    } catch {
      setError("Couldn't remove. Try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <SidePanel open onClose={onClose}>
      <div className="flex flex-col gap-5 p-6">
        <div className="flex items-center gap-3">
          <span className="w-2.5 h-2.5 rounded-full flex-none" style={{ background: `var(--series-${current.colorSlot})` }} />
          <h2 className="m-0 text-lg font-semibold text-text flex-1 truncate">{current.categoryName}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="w-8 h-8 flex items-center justify-center rounded-control text-text-3 hover:text-text hover:bg-sunken">
            <X size={18} />
          </button>
        </div>

        <div className="flex justify-between">
          <div className="flex flex-col gap-0.5">
            <span className="text-xs font-medium uppercase tracking-wide text-text-3">Spent</span>
            <span className="tabular text-[22px] font-semibold text-text">{fmt(current.spend)}</span>
          </div>
          <div className="flex flex-col gap-0.5 items-end">
            <span className="text-xs font-medium uppercase tracking-wide text-text-3">Budget</span>
            <span className="tabular text-[22px] font-semibold text-text">{fmt(current.amount + current.rolloverFromPrior)}</span>
          </div>
        </div>

        <section className="flex flex-col gap-2">
          <h3 className="m-0 text-[11px] font-semibold uppercase tracking-wide text-text-3">Last 6 months</h3>
          {history == null ? (
            <div className="h-[86px] rounded-control bg-sunken animate-pulse" />
          ) : (
            <div className="flex items-end gap-2 h-[86px]" role="img" aria-label="Spending by month for the last six months">
              {history.map((h) => {
                const over = h.amount != null && h.spend > h.amount;
                return (
                  <div key={h.month} className="flex-1 h-full flex flex-col items-center justify-end gap-1">
                    <span className="w-full rounded-t-[4px]" style={{ height: `${Math.max(2, (h.spend / maxBar) * 64)}px`, background: over ? "var(--negative)" : `var(--series-${current.colorSlot})` }} title={`${fmt(h.spend)}${h.amount != null ? ` of ${fmt(h.amount)}` : ""}`} />
                    <span className="text-[10.5px] text-text-3">{new Date(`${h.month}T00:00:00`).toLocaleDateString(undefined, { month: "short" })}</span>
                  </div>
                );
              })}
            </div>
          )}
          {avg != null && (
            <span className="text-xs text-text-3">
              {recent.length}-month average {fmt(avg)}
              {overCount > 0 ? ` · over budget ${overCount === 1 ? "once" : `${overCount} times`}` : ""}
              {avg > 0 && Math.abs(avg - amount) >= 1000 && (
                <>
                  {" · "}
                  <button type="button" className="text-brand hover:underline" onClick={() => setAmountInput(String(Math.ceil(avg / 1000) * 10))}>
                    Use {fmt(Math.ceil(avg / 1000) * 1000)}
                  </button>
                </>
              )}
            </span>
          )}
        </section>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium uppercase tracking-wide text-text-3">Monthly budget</span>
          <span className="flex items-center gap-1.5">
            <span className="text-text-3 text-sm">$</span>
            <input type="number" min="0" step="1" value={amountInput} onChange={(e) => setAmountInput(e.target.value)} className="w-full h-9 rounded-control bg-surface border border-border-strong px-3 text-[15px] text-text tabular focus:outline-none focus:ring-2 focus:ring-info" />
          </span>
        </label>

        <div className="flex flex-col rounded-control bg-sunken px-4">
          <Toggle label="Roll over what's left" hint="Unspent money adds to next month's budget." on={rollover} onChange={setRollover} />
          <Toggle label="Fixed amount" hint="For rent or insurance: shows paid / not paid instead of a pace." on={fixed} onChange={setFixed} border />
        </div>

        {error && <InlineError>{error}</InlineError>}
        <div className="flex flex-wrap gap-2">
          <Button onClick={save} loading={saving} disabled={!dirty}>
            Save
          </Button>
          <Link
            href={`/transactions?category=${current.categoryId}&from=${month}&to=${monthLastDay(month)}&transfer=0&excluded=0`}
            className="h-9 px-3 rounded-control bg-surface border border-border-strong text-[15px] font-medium text-text hover:bg-sunken inline-flex items-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-info"
          >
            See transactions
          </Link>
        </div>
        <Button variant="destructive" size="sm" onClick={remove} disabled={saving} className="self-start -ml-3">
          Remove budget
        </Button>
      </div>
    </SidePanel>
  );
}

function Toggle({ label, hint, on, onChange, border }: { label: string; hint: string; on: boolean; onChange: (v: boolean) => void; border?: boolean }) {
  return (
    <label className={cn("flex items-center justify-between gap-4 py-3 cursor-pointer", border && "border-t border-border")}>
      <span className="flex flex-col gap-0.5">
        <span className="text-[13.5px] text-text">{label}</span>
        <span className="text-xs text-text-3">{hint}</span>
      </span>
      <input type="checkbox" role="switch" checked={on} onChange={(e) => onChange(e.target.checked)} className="sr-only peer" />
      <span className={cn("relative w-9 h-5 rounded-full border transition-colors flex-none", on ? "bg-brand border-brand" : "bg-surface-2 border-border-strong")} aria-hidden="true">
        <span className={cn("absolute top-0.5 w-3.5 h-3.5 rounded-full transition-transform", on ? "translate-x-[18px] bg-on-brand" : "translate-x-0.5 bg-text-3")} />
      </span>
    </label>
  );
}
