"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { InlineError } from "@/components/ui/InlineError";
import { showToast } from "@/lib/toast";

/**
 * Sets or changes the year-end goal (PUT /api/goals) and removes it
 * (DELETE). Changing the target keeps where the goal started.
 */
export function GoalForm({ targetCents, deadline, defaultDeadline }: { targetCents?: number; deadline?: string; defaultDeadline: string }) {
  const router = useRouter();
  const [amount, setAmount] = useState(targetCents != null ? String(targetCents / 100) : "");
  const [date, setDate] = useState(deadline ?? defaultDeadline);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const editing = targetCents != null;

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

  async function remove() {
    setSaving(true);
    try {
      const res = await fetch("/api/goals", { method: "DELETE" });
      if (!res.ok) throw new Error();
      showToast("Goal removed", "positive");
      router.refresh();
    } catch {
      setError("Couldn't remove the goal. Try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={save} className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-4">
        <label className="flex flex-col gap-1.5 flex-1 min-w-[180px]">
          <span className="text-xs font-medium uppercase tracking-[0.06em] text-text-2">Net worth to reach</span>
          <span className="flex items-center h-9 rounded-control border border-border-strong bg-surface px-3 gap-1.5 focus-within:outline focus-within:outline-2 focus-within:outline-info">
            <span className="text-text-3">$</span>
            <input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="200,000" className="flex-1 min-w-0 bg-transparent outline-none text-right tabular text-[15px] text-text" aria-label="Net worth to reach, CAD" />
            <span className="text-text-3 text-[13px]">CAD</span>
          </span>
        </label>
        <label className="flex flex-col gap-1.5 min-w-[160px]">
          <span className="text-xs font-medium uppercase tracking-[0.06em] text-text-2">By</span>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-9 rounded-control border border-border-strong bg-surface px-3 text-[15px] text-text" />
        </label>
      </div>
      {error && <InlineError>{error}</InlineError>}
      <div className="flex items-center gap-3">
        <Button type="submit" loading={saving}>{editing ? "Save goal" : "Set goal"}</Button>
        {editing && (
          <Button type="button" variant="destructive" onClick={remove} disabled={saving}>
            Remove goal
          </Button>
        )}
      </div>
    </form>
  );
}
