"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";

export function CreditLimitEditor({ accountId, creditLimitIsManual }: { accountId: string; creditLimitIsManual: boolean }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [amountInput, setAmountInput] = useState("");
  const [saving, setSaving] = useState(false);

  async function save(creditLimit: number | null) {
    setSaving(true);
    try {
      const res = await fetch(`/api/accounts/${accountId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ creditLimit }),
      });
      if (!res.ok) throw new Error("Failed to update credit limit");
      setEditing(false);
      setAmountInput("");
      router.refresh();
    } catch (err) {
      console.error(err);
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
      <form onSubmit={submit} className="flex items-center gap-1.5">
        <span className="text-text-3 text-sm">$</span>
        <input
          type="number"
          step="0.01"
          min="0"
          autoFocus
          placeholder="0.00"
          value={amountInput}
          onChange={(e) => setAmountInput(e.target.value)}
          className="w-24 h-8 rounded-control bg-surface-2 border border-border-strong px-2 text-sm text-text tabular"
        />
        <Button type="submit" size="sm" disabled={saving}>
          {saving ? "Saving…" : "Save"}
        </Button>
        <Button type="button" variant="ghost" size="sm" disabled={saving} onClick={() => setEditing(false)}>
          Cancel
        </Button>
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
