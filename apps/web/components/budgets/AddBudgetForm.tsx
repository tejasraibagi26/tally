"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { SearchableSelect } from "@/components/ui/SearchableSelect";

export interface UnbudgetedCategory {
  id: string;
  name: string;
}

export function AddBudgetForm({ month, categories }: { month: string; categories: UnbudgetedCategory[] }) {
  const router = useRouter();
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? "");
  const [amountInput, setAmountInput] = useState("");
  const [rollover, setRollover] = useState(false);
  const [fixed, setFixed] = useState(false);
  const [saving, setSaving] = useState(false);

  if (categories.length === 0) return null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const amount = Math.round(parseFloat(amountInput) * 100);
    if (!categoryId || !Number.isFinite(amount) || amount < 0) return;
    setSaving(true);
    try {
      const res = await fetch("/api/budgets", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ month, categoryId, amount, rolloverEnabled: rollover, isFixedAmount: fixed }),
      });
      if (!res.ok) throw new Error("Failed to create budget");
      setAmountInput("");
      setRollover(false);
      setFixed(false);
      router.refresh();
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex items-center gap-2 flex-wrap px-4 py-3">
      <SearchableSelect
        value={categoryId}
        onChange={setCategoryId}
        buttonPlaceholder="Choose category"
        placeholder="Search categories…"
        className="w-56"
        options={categories.map((c) => ({ value: c.id, label: c.name }))}
      />
      <span className="text-text-3 text-sm">$</span>
      <input
        type="number"
        step="0.01"
        min="0"
        placeholder="0.00"
        value={amountInput}
        onChange={(e) => setAmountInput(e.target.value)}
        required
        className="w-28 h-9 rounded-control bg-surface-2 border border-border-strong px-2 text-sm text-text tabular"
      />
      <label className="flex items-center gap-1.5 text-sm text-text-2">
        <input type="checkbox" checked={rollover} onChange={(e) => setRollover(e.target.checked)} />
        Rollover unused
      </label>
      <label className="flex items-center gap-1.5 text-sm text-text-2" title="A fixed charge like rent or insurance — skips the burn-rate projection, which assumes spend accrues gradually through the month">
        <input type="checkbox" checked={fixed} onChange={(e) => setFixed(e.target.checked)} />
        Fixed amount
      </label>
      <Button type="submit" size="sm" disabled={saving}>
        {saving ? "Adding…" : "Add budget"}
      </Button>
    </form>
  );
}
