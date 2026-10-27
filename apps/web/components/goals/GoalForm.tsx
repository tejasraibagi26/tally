"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { InlineError } from "@/components/ui/InlineError";
import { useConfirmAction } from "@/components/ui/useConfirmAction";
import { showToast } from "@/lib/toast";

/**
 * What the amount field shows while typing: digits grouped in thousands,
 * at most two decimals. The dot survives the keystroke that types it
 * ("65000." stays) so the next digit lands in the decimals.
 */
function maskAmount(raw: string): string {
  const cleaned = raw.replace(/[^\d.]/g, "");
  const [whole = "", ...rest] = cleaned.split(".");
  const grouped = whole.replace(/^0+(?=\d)/, "").replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  if (!cleaned.includes(".")) return grouped;
  return `${grouped}.${rest.join("").slice(0, 2)}`;
}

/** Digits and the decimal point — what the caret counts, since commas move. */
function significant(s: string): number {
  return s.replace(/[^\d.]/g, "").length;
}

/** Where the caret sits in the masked text after `n` significant characters. */
function caretAfter(masked: string, n: number): number {
  if (n <= 0) return 0;
  let seen = 0;
  for (let i = 0; i < masked.length; i++) {
    if (/[\d.]/.test(masked[i]!) && ++seen === n) return i + 1;
  }
  return masked.length;
}

/**
 * Sets or changes the year-end goal (PUT /api/goals) and removes it
 * (DELETE). Changing the target keeps where the goal started.
 */
export function GoalForm({ targetCents, deadline, defaultDeadline }: { targetCents?: number; deadline?: string; defaultDeadline: string }) {
  const router = useRouter();
  const [amount, setAmount] = useState(targetCents != null ? maskAmount(String(targetCents / 100)) : "");
  const [date, setDate] = useState(deadline ?? defaultDeadline);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { confirm, dialog } = useConfirmAction();
  const editing = targetCents != null;

  /**
   * Masks as you type without the caret jumping to the end: the input's
   * value and selection are set on the node first, so React's re-render
   * with the same string leaves the selection alone.
   */
  function onAmountChange(e: React.ChangeEvent<HTMLInputElement>) {
    const el = e.currentTarget;
    const before = significant(el.value.slice(0, el.selectionStart ?? el.value.length));
    const masked = maskAmount(el.value);
    const caret = caretAfter(masked, before);
    el.value = masked;
    el.setSelectionRange(caret, caret);
    setAmount(masked);
    setError(null);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const cents = Math.round(Number(amount.replace(/[$,\s]/g, "")) * 100);
    if (!Number.isFinite(cents) || cents <= 0) {
      setError("Enter the net worth you want to reach.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/goals", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ targetCents: cents, deadline: date }) });
      if (!res.ok) throw new Error();
      showToast(editing ? "Goal updated" : "Goal set", "positive");
      router.refresh();
    } catch {
      setError("Couldn't save the goal. Try again.");
    } finally {
      setSaving(false);
    }
  }

  function remove() {
    confirm({
      title: "Remove this goal?",
      description: <p className="m-0">Tally stops tracking the pace. Your net worth history stays as it is, and you can set a new goal any time.</p>,
      confirmLabel: "Remove goal",
      failure: "Couldn't remove the goal. Check your connection and try again.",
      run: async () => {
        const res = await fetch("/api/goals", { method: "DELETE" });
        if (!res.ok) throw new Error("Failed to remove goal");
        showToast("Goal removed", "positive");
        router.refresh();
      },
    });
  }

  return (
    <>
      <form onSubmit={save} className="flex flex-col gap-5">
        {/* Both fields are sized to what they hold: a stretched money box
            leaves the figure stranded a card's width from its "$". */}
        <div className="flex flex-wrap items-end gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium uppercase tracking-[0.06em] text-text-2">Net worth to reach</span>
            <span className="flex items-center h-10 w-[220px] rounded-control border border-border-strong bg-surface px-3 gap-1.5 focus-within:outline focus-within:outline-2 focus-within:outline-info">
              <span className="text-text-3 text-[15px]">$</span>
              <input
                inputMode="decimal"
                value={amount}
                onChange={onAmountChange}
                placeholder="200,000"
                className="flex-1 min-w-0 bg-transparent outline-none tabular text-[17px] font-semibold text-text placeholder:font-normal placeholder:text-text-3"
                aria-label="Net worth to reach, CAD"
              />
              <span className="text-text-3 text-[13px]">CAD</span>
            </span>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium uppercase tracking-[0.06em] text-text-2">By</span>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="h-10 w-[180px] rounded-control border border-border-strong bg-surface px-3 text-[15px] text-text tabular focus:outline focus:outline-2 focus:outline-info"
            />
          </label>
        </div>
        {error && <InlineError>{error}</InlineError>}
        <div className="flex flex-wrap items-center gap-3 border-t border-border pt-4">
          <Button type="submit" loading={saving}>{editing ? "Save goal" : "Set goal"}</Button>
          {editing && (
            <Button type="button" variant="destructive" onClick={remove} disabled={saving} aria-haspopup="dialog" className="ml-auto">
              Remove goal
            </Button>
          )}
        </div>
      </form>
      {dialog}
    </>
  );
}
