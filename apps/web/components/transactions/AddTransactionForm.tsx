"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { AmountInput, FormField, FormPanel, panelInputClass } from "@/components/ui/FormPanel";
import { showToast } from "@/lib/toast";
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
// FormPanel side sheet as AddBillForm.tsx; hits POST /api/transactions, which stamps the
// row isManual so it's editable/deletable like any other manual entry.
export function AddTransactionForm({ accounts, categories }: { accounts: TransactionAccountOption[]; categories: TransactionCategoryOption[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<"expense" | "income">("expense");
  const [name, setName] = useState("");
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "");
  const [categoryId, setCategoryId] = useState("");
  const [amountInput, setAmountInput] = useState("");
  const [postedDate, setPostedDate] = useState(todayDate());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (accounts.length === 0) return null;

  function close() {
    setOpen(false);
    setError(null);
  }

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
        setError(data.error ?? "Couldn't add the transaction. Try again.");
        return;
      }
      showToast(`${name.trim()} added`);
      close();
      reset();
      router.refresh();
    } catch (err) {
      console.error(err);
      setError("Couldn't add the transaction. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        + Add transaction
      </Button>
      <FormPanel
        open={open}
        onClose={close}
        title="Add transaction"
        description="For cash, or anything from an account Tally isn't linked to."
        onSubmit={submit}
        submitLabel="Add transaction"
        submitting={saving}
        error={error}
      >
        <div className="grid grid-cols-2 rounded-control border border-border-strong overflow-hidden h-9">
          <button
            type="button"
            onClick={() => setKind("expense")}
            className={cn("text-sm font-medium", kind === "expense" ? "bg-negative-subtle text-negative" : "bg-surface text-text-2")}
          >
            Expense
          </button>
          <button
            type="button"
            onClick={() => setKind("income")}
            className={cn("text-sm font-medium", kind === "income" ? "bg-positive-subtle text-positive" : "bg-surface text-text-2")}
          >
            Income
          </button>
        </div>
        <FormField label="Description">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Coffee" required autoFocus className={panelInputClass} />
        </FormField>
        <FormField label="Amount">
          <AmountInput value={amountInput} onChange={setAmountInput} />
        </FormField>
        <FormField label="Date">
          <input type="date" value={postedDate} onChange={(e) => setPostedDate(e.target.value)} required className={panelInputClass} />
        </FormField>
        <FormField label="Account">
          <SearchableSelect
            value={accountId}
            onChange={setAccountId}
            buttonPlaceholder="Choose account"
            placeholder="Search accounts…"
            className="w-full"
            options={accounts.map((a) => ({ value: a.id, label: `${a.name} ····${a.mask ?? "----"}` }))}
          />
        </FormField>
        <FormField label="Category">
          <SearchableSelect
            value={categoryId}
            onChange={setCategoryId}
            buttonPlaceholder="Category (optional)"
            placeholder="Search categories…"
            className="w-full"
            options={[{ value: "", label: "Uncategorized" }, ...categories.map((c) => ({ value: c.id, label: c.name, colorSlot: c.colorSlot, indent: c.indent }))]}
          />
        </FormField>
      </FormPanel>
    </>
  );
}
