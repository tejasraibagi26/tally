"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { InlineError } from "@/components/ui/InlineError";
import { showToast } from "@/lib/toast";

export function CreditLimitEditor({ accountId, creditLimitIsManual }: { accountId: string; creditLimitIsManual: boolean }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [amountInput, setAmountInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);

  async function save(creditLimit: number | null) {
    setSaving(true);
    setFailed(false);
    try {
      const res = await fetch(`/api/accounts/${accountId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ creditLimit }),
      });
      if (!res.ok) throw new Error("Failed to update credit limit");
      setEditing(false);
      setAmountInput("");
      showToast(creditLimit == null ? "Limit cleared" : `Limit set to $${creditLimit.toLocaleString("en-US", { maximumFractionDigits: 2 })}`);
      router.refresh();
    } catch (err) {
      console.error(err);
      // Stays in edit mode with the value kept, so trying again is one click.
      setFailed(true);
    } finally {
      setSaving(false);
    }
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const dollars = parseFloat(amountInput);
    if (!Number.isFinite(dollars) || dollars < 0) return;
    void save(dollars);
  }

  if (editing) {
    return (
      <form onSubmit={submit} className="flex flex-wrap items-center gap-1.5">
        <span className="text-text-3 text-sm">$</span>
        <input
          type="number"
          step="0.01"
          min="0"
          autoFocus
          placeholder="0.00"
          value={amountInput}
          onChange={(e) => setAmountInput(e.target.value)}
          aria-invalid={failed || undefined}
          className="w-24 h-[30px] rounded-control bg-surface border border-border-strong px-2 text-sm text-text tabular focus:outline-none focus:ring-2 focus:ring-info"
        />
        <Button type="submit" size="sm" loading={saving}>
          Save
        </Button>
        <Button type="button" variant="ghost" size="sm" disabled={saving} onClick={() => setEditing(false)}>
          Cancel
        </Button>
        {failed && <InlineError className="basis-full">Couldn&apos;t save the limit. Try again.</InlineError>}
      </form>
    );
  }

  if (creditLimitIsManual) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs text-text-3">(entered manually)</span>
        <button
          type="button"
          className="text-xs text-brand disabled:opacity-40"
          disabled={saving}
          onClick={() => setEditing(true)}
        >
          Edit
        </button>
        <button
          type="button"
          className="text-xs text-text-3 hover:text-negative disabled:opacity-40"
          disabled={saving}
          onClick={() => void save(null)}
        >
          Remove
        </button>
      </div>
    );
  }

  return (
    <button type="button" className="text-xs text-brand" onClick={() => setEditing(true)}>
      Add limit
    </button>
  );
}
