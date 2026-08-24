"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { SearchableSelect } from "@/components/ui/SearchableSelect";

export interface BillAccountOption {
  id: string;
  name: string;
  mask: string | null;
}

export interface BillCategoryOption {
  id: string;
  name: string;
}

/**
 * Fallback for a bill that lib/recurringDetection.ts never picked up at all —
 * an irregular payer (rent prepaid several months at once) can fail its
 * "3+ occurrences, stable interval" bar from the very first payment, so
 * there's no row in Subscriptions for NextDueDateEditor to attach to.
 * Creates one directly with manualNextDueDate already set.
 */
export function AddBillForm({ accounts, categories }: { accounts: BillAccountOption[]; categories: BillCategoryOption[] }) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [description, setDescription] = useState("");
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "");
  const [categoryId, setCategoryId] = useState("");
  const [amountInput, setAmountInput] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (accounts.length === 0) return null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const amount = Math.round(parseFloat(amountInput) * 100);
    if (!description.trim() || !accountId || !dueDate || !Number.isFinite(amount) || amount <= 0) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/recurring-streams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: description.trim(), accountId, categoryId: categoryId || null, amount, manualNextDueDate: dueDate }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Something went wrong");
        return;
      }
      setAdding(false);
      setDescription("");
      setAmountInput("");
      setDueDate("");
      setCategoryId("");
      router.refresh();
    } catch (err) {
      console.error(err);
      setError("Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  if (!adding) {
    return (
      <Button variant="secondary" size="sm" onClick={() => setAdding(true)}>
        + Add a bill
      </Button>
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3 p-3 rounded-control bg-surface-2 border border-border w-fit">
      <div className="flex items-center gap-2 flex-wrap">
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Rent"
          className="w-40 h-9 rounded-control bg-surface border border-border-strong px-2 text-sm text-text"
        />
        <SearchableSelect
          value={accountId}
          onChange={setAccountId}
          buttonPlaceholder="Choose account"
          placeholder="Search accounts…"
          className="w-56"
          options={accounts.map((a) => ({ value: a.id, label: `${a.name} ····${a.mask ?? "----"}` }))}
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
          className="w-28 h-9 rounded-control bg-surface border border-border-strong px-2 text-sm text-text tabular"
        />
        <SearchableSelect
          value={categoryId}
          onChange={setCategoryId}
          buttonPlaceholder="Category (optional)"
          placeholder="Search categories…"
          className="w-48"
          options={[{ value: "", label: "Uncategorized" }, ...categories.map((c) => ({ value: c.id, label: c.name }))]}
        />
        <span className="text-text-3 text-sm">Next due</span>
        <input
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          required
          className="h-9 rounded-control bg-surface border border-border-strong px-2 text-sm text-text"
        />
      </div>

      {error && <p className="text-sm text-negative">{error}</p>}

      <div className="flex items-center gap-3">
        <Button type="submit" size="sm" disabled={saving}>
          {saving ? "Adding…" : "Add bill"}
        </Button>
        <button type="button" onClick={() => setAdding(false)} className="text-sm text-text-2">
          Cancel
        </button>
      </div>
    </form>
  );
}
