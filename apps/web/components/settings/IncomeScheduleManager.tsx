"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { AmountInput, FormField, FormPanel, panelInputClass } from "@/components/ui/FormPanel";
import { useConfirmAction } from "@/components/ui/useConfirmAction";
import { formatCents } from "@tally/core/money";

export interface IncomeAccountOption {
  id: string;
  name: string;
  mask: string | null;
}

export interface IncomeCategoryOption {
  id: string;
  name: string;
}

export interface IncomeScheduleData {
  id: string;
  accountId: string;
  accountName: string | null;
  accountMask: string | null;
  categoryId: string | null;
  categoryName: string | null;
  label: string;
  amount: number;
  dayAnchors: number[];
  active: boolean;
}

const NONE = "__none__";
const LAST_DAY = "0";

function ordinal(n: number): string {
  const rem100 = n % 100;
  if (rem100 >= 11 && rem100 <= 13) return `${n}th`;
  switch (n % 10) {
    case 1: return `${n}st`;
    case 2: return `${n}nd`;
    case 3: return `${n}rd`;
    default: return `${n}th`;
  }
}

function anchorLabel(anchor: number): string {
  return anchor === 0 ? "last day of the month" : `the ${ordinal(anchor)}`;
}

function dayOptions(): { value: string; label: string }[] {
  return [{ value: LAST_DAY, label: "Last day of the month" }, ...Array.from({ length: 31 }, (_, i) => ({ value: String(i + 1), label: ordinal(i + 1) }))];
}

export function IncomeScheduleManager({
  accounts,
  categories,
  schedules,
}: {
  accounts: IncomeAccountOption[];
  categories: IncomeCategoryOption[];
  schedules: IncomeScheduleData[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("Paycheck");
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "");
  const [categoryId, setCategoryId] = useState("");
  const [amountInput, setAmountInput] = useState("");
  const [anchor1, setAnchor1] = useState("15");
  const [anchor2, setAnchor2] = useState<string>(LAST_DAY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const { confirm: confirmAction, dialog: confirmDialog } = useConfirmAction();

  if (accounts.length === 0) return <p className="text-text-2 text-sm">Connect or add an account first, then come back here to set up an income schedule.</p>;

  function close() {
    setOpen(false);
    setError(null);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const amount = Math.round(parseFloat(amountInput) * 100);
    if (!accountId || !Number.isFinite(amount) || amount <= 0) return;
    const dayAnchors = anchor2 === NONE ? [Number(anchor1)] : [Number(anchor1), Number(anchor2)];
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/income-schedules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId, categoryId: categoryId || null, label: label.trim() || "Paycheck", amount, dayAnchors }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Something went wrong");
        return;
      }
      close();
      setLabel("Paycheck");
      setAmountInput("");
      setCategoryId("");
      setAnchor1("15");
      setAnchor2(LAST_DAY);
      router.refresh();
    } catch (err) {
      console.error(err);
      setError("Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(schedule: IncomeScheduleData) {
    setBusyId(schedule.id);
    try {
      const res = await fetch(`/api/income-schedules/${schedule.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !schedule.active }),
      });
      if (!res.ok) throw new Error("Failed to update schedule");
      router.refresh();
    } catch (err) {
      console.error(err);
    } finally {
      setBusyId(null);
    }
  }

  function remove(schedule: IncomeScheduleData) {
    confirmAction({
      title: `Delete "${schedule.label}"?`,
      description: <p className="m-0">Paychecks it already added stay in your transactions.</p>,
      confirmLabel: "Delete schedule",
      failure: "Couldn't delete this schedule. Check your connection and try again.",
      run: async () => {
        const res = await fetch(`/api/income-schedules/${schedule.id}`, { method: "DELETE" });
        if (!res.ok) throw new Error("Failed to delete schedule");
        router.refresh();
      },
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {schedules.length > 0 && (
        <div className="flex flex-col gap-2">
          {schedules.map((s) => (
            <div key={s.id} className="flex items-center gap-3 px-3 py-2.5 rounded-control bg-surface-2 border border-border">
              <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                <span className="text-[15px] text-text truncate">{s.label}</span>
                <span className="text-[13px] text-text-3 truncate">
                  {s.accountName ? `${s.accountName} ····${s.accountMask ?? "----"}` : "—"} · {s.dayAnchors.map(anchorLabel).join(" & ")}
                  {s.dayAnchors.length > 1 ? " (Friday if it lands on a weekend)" : ""}
                  {s.categoryName ? ` · ${s.categoryName}` : ""}
                </span>
              </div>
              <span className="text-[15px] text-positive tabular money flex-none">{formatCents(s.amount)}</span>
              <button
                onClick={() => toggleActive(s)}
                disabled={busyId === s.id}
                className="text-[13px] text-text-2 hover:text-text flex-none disabled:opacity-40"
              >
                {s.active ? "Pause" : "Resume"}
              </button>
              <button
                onClick={() => remove(s)}
                disabled={busyId === s.id}
                className="text-[13px] text-negative hover:underline flex-none disabled:opacity-40"
              >
                Delete
              </button>
            </div>
          ))}
        </div>
      )}

      <div>
        <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
          + Add income schedule
        </Button>
      </div>
      <FormPanel
        open={open}
        onClose={close}
        title="Add income schedule"
        description="Adds your paycheck automatically on payday, for income Tally can't see arrive."
        onSubmit={submit}
        submitLabel="Add schedule"
        submittingLabel="Adding…"
        submitting={saving}
        error={error}
      >
        <FormField label="Name">
          <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Paycheck" autoFocus className={panelInputClass} />
        </FormField>
        <FormField label="Amount per paycheck">
          <AmountInput value={amountInput} onChange={setAmountInput} />
        </FormField>
        <FormField label="Deposited to">
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
        <FormField label="Paid on" hint="Moved to the preceding Friday if it lands on a weekend.">
          <SearchableSelect value={anchor1} onChange={setAnchor1} className="w-full" options={dayOptions()} />
          {anchor2 !== NONE ? (
            <div className="flex items-center gap-2">
              <span className="text-[13px] text-text-2">and</span>
              <SearchableSelect value={anchor2} onChange={setAnchor2} className="flex-1" options={dayOptions()} />
              <button type="button" onClick={() => setAnchor2(NONE)} className="text-[13px] text-text-3 hover:text-negative">
                Remove
              </button>
            </div>
          ) : (
            <button type="button" onClick={() => setAnchor2(LAST_DAY)} className="text-[13px] text-brand w-fit">
              + Add a second payday
            </button>
          )}
        </FormField>
      </FormPanel>
      {confirmDialog}
    </div>
  );
}
