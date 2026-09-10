"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { SearchableSelect } from "@/components/ui/SearchableSelect";

export interface UnbudgetedCategory {
  id: string;
  name: string;
}

const NEW_CATEGORY_VALUE = "__new__";

export function AddBudgetForm({ month, categories }: { month: string; categories: UnbudgetedCategory[] }) {
  const router = useRouter();
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? "");
  const [newCategoryName, setNewCategoryName] = useState("");
  const [amountInput, setAmountInput] = useState("");
  const [rollover, setRollover] = useState(false);
  const [fixed, setFixed] = useState(false);
  const [saving, setSaving] = useState(false);

  const isNewCategory = categoryId === NEW_CATEGORY_VALUE;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const amount = Math.round(parseFloat(amountInput) * 100);
    if (!Number.isFinite(amount) || amount < 0) return;
    if (isNewCategory ? !newCategoryName.trim() : !categoryId) return;
    setSaving(true);
    try {
      let resolvedCategoryId = categoryId;
      if (isNewCategory) {
        const createRes = await fetch("/api/categories", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: newCategoryName.trim(), kind: "expense" }),
        });
        if (!createRes.ok) throw new Error("Failed to create category");
        const { category } = await createRes.json();
        resolvedCategoryId = category.id;
      }

      const res = await fetch("/api/budgets", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ month, categoryId: resolvedCategoryId, amount, rolloverEnabled: rollover, isFixedAmount: fixed }),
      });
      if (!res.ok) throw new Error("Failed to create budget");
      setAmountInput("");
      setNewCategoryName("");
      setCategoryId(categories[0]?.id ?? "");
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
        options={[{ value: NEW_CATEGORY_VALUE, label: "+ New category" }, ...categories.map((c) => ({ value: c.id, label: c.name }))]}
      />
      {isNewCategory && (
        <input
          type="text"
          placeholder="Category name"
          value={newCategoryName}
          onChange={(e) => setNewCategoryName(e.target.value)}
          required
          maxLength={80}
          className="w-40 h-9 rounded-control bg-surface-2 border border-border-strong px-2 text-sm text-text"
        />
      )}
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
