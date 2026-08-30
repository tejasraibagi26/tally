"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { cn } from "@/lib/cn";

export interface TransactionAccountOption {
  id: string;
  name: string;
  mask: string | null;
}

export interface TransactionCategoryOption {
  id: string;
  name: string;
  colorSlot: number;
  indent: boolean;
}

function todayDate(): string {
  return new Date().toISOString().slice(0, 10);
}

// For a purchase Plaid never saw -- cash, a bank this app isn't linked to,
// or something the user just wants tracked right away. Same inline-toggle
// pattern as AddBillForm.tsx; hits POST /api/transactions, which stamps the
// row isManual so it's editable/deletable like any other manual entry.
export function AddTransactionForm({ accounts, categories }: { accounts: TransactionAccountOption[]; categories: TransactionCategoryOption[] }) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [kind, setKind] = useState<"expense" | "income">("expense");
  const [name, setName] = useState("");
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "");
  const [categoryId, setCategoryId] = useState("");
  const [amountInput, setAmountInput] = useState("");
  const [postedDate, setPostedDate] = useState(todayDate());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (accounts.length === 0) return null;

  function reset() {
    setName("");
    setAmountInput("");
    setCategoryId("");
    setPostedDate(todayDate());
    setKind("expense");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const amount = Math.round(parseFloat(amountInput) * 100);
    if (!name.trim() || !accountId || !postedDate || !Number.isFinite(amount) || amount <= 0) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId, postedDate, name: name.trim(), amount, kind, categoryId: categoryId || null }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Something went wrong");
        return;
      }
      setAdding(false);
      reset();
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
        + Add transaction
      </Button>
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3 p-3 rounded-control bg-surface-2 border border-border w-fit">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex rounded-control border border-border-strong overflow-hidden h-9">
          <button
            type="button"
            onClick={() => setKind("expense")}
            className={cn("px-3 text-sm font-medium", kind === "expense" ? "bg-negative-subtle text-negative" : "bg-surface text-text-2")}
          >
            Expense
          </button>
          <button
            type="button"
            onClick={() => setKind("income")}
            className={cn("px-3 text-sm font-medium", kind === "income" ? "bg-positive-subtle text-positive" : "bg-surface text-text-2")}
          >
            Income
          </button>
        </div>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Description"
          className="w-44 h-9 rounded-control bg-surface border border-border-strong px-2 text-sm text-text"
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
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <SearchableSelect
          value={accountId}
          onChange={setAccountId}
          buttonPlaceholder="Choose account"
          placeholder="Search accounts…"
          className="w-56"
          options={accounts.map((a) => ({ value: a.id, label: `${a.name} ····${a.mask ?? "----"}` }))}
        />
        <SearchableSelect
          value={categoryId}
          onChange={setCategoryId}
          buttonPlaceholder="Category (optional)"
          placeholder="Search categories…"
          className="w-48"
          options={[{ value: "", label: "Uncategorized" }, ...categories.map((c) => ({ value: c.id, label: c.name, colorSlot: c.colorSlot, indent: c.indent }))]}
        />
        <input
          type="date"
          value={postedDate}
          onChange={(e) => setPostedDate(e.target.value)}
          required
          className="h-9 rounded-control bg-surface border border-border-strong px-2 text-sm text-text"
        />
      </div>

      {error && <p className="text-sm text-negative">{error}</p>}

      <div className="flex items-center gap-3">
        <Button type="submit" size="sm" disabled={saving}>
          {saving ? "Adding…" : "Add transaction"}
        </Button>
        <button type="button" onClick={() => setAdding(false)} className="text-sm text-text-2">
          Cancel
        </button>
      </div>
    </form>
  );
}
