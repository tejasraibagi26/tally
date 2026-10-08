"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { AmountInput, FormField, FormPanel, panelInputClass } from "@/components/ui/FormPanel";
import { showToast } from "@/lib/toast";

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
  const [open, setOpen] = useState(false);
  const [description, setDescription] = useState("");
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "");
  const [categoryId, setCategoryId] = useState("");
  const [amountInput, setAmountInput] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (accounts.length === 0) return null;

  function close() {
    setOpen(false);
    setError(null);
  }

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
        setError(data.error ?? "Couldn't add the bill. Try again.");
        return;
      }
      showToast(`${description.trim()} added`);
      close();
      setDescription("");
      setAmountInput("");
      setDueDate("");
      setCategoryId("");
      router.refresh();
    } catch (err) {
      console.error(err);
      setError("Couldn't reach Tally. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        + Add a bill
      </Button>
      <FormPanel
        open={open}
        onClose={close}
        title="Add a bill"
        description="For a recurring charge Tally hasn't picked up on its own, like rent paid in lump sums."
        onSubmit={submit}
        submitLabel="Add bill"
        submitting={saving}
        error={error}
      >
        <FormField label="Name">
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Rent"
            required
            autoFocus
            className={panelInputClass}
          />
        </FormField>
        <FormField label="Amount">
          <AmountInput value={amountInput} onChange={setAmountInput} />
        </FormField>
        <FormField label="Paid from">
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
            options={[{ value: "", label: "Uncategorized" }, ...categories.map((c) => ({ value: c.id, label: c.name }))]}
          />
        </FormField>
        <FormField label="Next due">
          <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} required className={panelInputClass} />
        </FormField>
      </FormPanel>
    </>
  );
}
