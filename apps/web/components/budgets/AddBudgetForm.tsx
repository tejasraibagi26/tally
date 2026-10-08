"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { AmountInput, CheckboxField, FormField, FormPanel, panelInputClass } from "@/components/ui/FormPanel";
import { showToast } from "@/lib/toast";

export interface UnbudgetedCategory {
  id: string;
  name: string;
}

const NEW_CATEGORY_VALUE = "__new__";

export function AddBudgetForm({ month, monthLabel, categories }: { month: string; monthLabel: string; categories: UnbudgetedCategory[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? "");
  const [newCategoryName, setNewCategoryName] = useState("");
  const [amountInput, setAmountInput] = useState("");
  const [rollover, setRollover] = useState(false);
  const [fixed, setFixed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isNewCategory = categoryId === NEW_CATEGORY_VALUE;

  function close() {
    setOpen(false);
    setError(null);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const amount = Math.round(parseFloat(amountInput) * 100);
    if (!Number.isFinite(amount) || amount < 0) return;
    if (isNewCategory ? !newCategoryName.trim() : !categoryId) {
      setError(isNewCategory ? "Name the new category." : "Choose a category.");
      return;
    }
    setSaving(true);
    setError(null);
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
      const budgetName = categories.find((c) => c.id === resolvedCategoryId)?.name ?? newCategoryName.trim();
      showToast(budgetName ? `${budgetName} budget added` : "Budget added");
      setAmountInput("");
      setNewCategoryName("");
      setCategoryId(categories[0]?.id ?? "");
      setRollover(false);
      setFixed(false);
      close();
      router.refresh();
    } catch (err) {
      console.error(err);
      setError("Couldn't add the budget. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        + Add budget
      </Button>
      <FormPanel
        open={open}
        onClose={close}
        title="Add budget"
        description={`Set a spending limit for ${monthLabel}.`}
        onSubmit={submit}
        submitLabel="Add budget"
        submitting={saving}
        error={error}
      >
        <FormField label="Category">
          <SearchableSelect
            value={categoryId}
            onChange={setCategoryId}
            buttonPlaceholder="Choose category"
            placeholder="Search categories…"
            className="w-full"
            options={[{ value: NEW_CATEGORY_VALUE, label: "+ New category" }, ...categories.map((c) => ({ value: c.id, label: c.name }))]}
          />
        </FormField>
        {isNewCategory && (
          <FormField label="New category name">
            <input
              type="text"
              placeholder="e.g. Pets"
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              required
              maxLength={80}
              autoFocus
              className={panelInputClass}
            />
          </FormField>
        )}
        <FormField label="Monthly limit">
          <AmountInput value={amountInput} onChange={setAmountInput} />
        </FormField>
        <div className="flex flex-col gap-3 pt-1">
          <CheckboxField checked={rollover} onChange={setRollover} label="Rollover unused" hint="Whatever's left this month carries into next month's limit." />
          <CheckboxField
            checked={fixed}
            onChange={setFixed}
            label="Fixed amount"
            hint="A fixed charge like rent or insurance. Skips the burn-rate projection, which assumes spend accrues gradually through the month."
          />
        </div>
      </FormPanel>
    </>
  );
}
