"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { AmountInput, CheckboxField, FormField, FormPanel, panelInputClass } from "@/components/ui/FormPanel";

type Field = "description" | "merchant" | "amount" | "account" | "direction";

const OPS_BY_FIELD: Record<Field, { value: string; label: string }[]> = {
  description: [
    { value: "contains", label: "contains" },
    { value: "equals", label: "equals" },
    { value: "regex", label: "matches regex" },
  ],
  merchant: [
    { value: "equals", label: "equals" },
    { value: "contains", label: "contains" },
  ],
  amount: [
    { value: "gte", label: "at least" },
    { value: "lte", label: "at most" },
  ],
  account: [{ value: "equals", label: "is" }],
  direction: [{ value: "equals", label: "is" }],
};

export interface RuleFormCategory {
  id: string;
  name: string;
  colorSlot?: number;
  indent?: boolean;
}

export interface RuleFormAccount {
  id: string;
  name: string;
}

export function RuleForm({ categories, accounts }: { categories: RuleFormCategory[]; accounts: RuleFormAccount[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [field, setField] = useState<Field>("merchant");
  const [op, setOp] = useState("equals");
  const [textValue, setTextValue] = useState("");
  const [amountValue, setAmountValue] = useState("");
  const [accountValue, setAccountValue] = useState(accounts[0]?.id ?? "");
  const [directionValue, setDirectionValue] = useState<"in" | "out">("out");

  const [setCategoryId, setSetCategoryId] = useState("");
  const [addTag, setAddTag] = useState("");
  const [exclude, setExclude] = useState(false);
  const [markTransfer, setMarkTransfer] = useState(false);
  const [priority, setPriority] = useState("0");
  const [applyToExisting, setApplyToExisting] = useState(true);

  const [previewCount, setPreviewCount] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function close() {
    setOpen(false);
    setError(null);
  }

  function buildMatch() {
    if (field === "amount") return { field, op, value: Math.round(parseFloat(amountValue || "0") * 100) };
    if (field === "account") return { field, op, value: accountValue };
    if (field === "direction") return { field, op, value: directionValue };
    return { field, op, value: textValue };
  }

  function buildActions() {
    const actions: Record<string, unknown> = {};
    if (setCategoryId) actions.setCategoryId = setCategoryId;
    if (addTag.trim()) actions.addTag = addTag.trim();
    if (exclude) actions.exclude = true;
    if (markTransfer) actions.markTransfer = true;
    return actions;
  }

  function hasAnyAction(actions: Record<string, unknown>) {
    return Object.keys(actions).length > 0;
  }

  async function handlePreview() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/rules?preview=1", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ match: buildMatch() }),
      });
      if (!res.ok) throw new Error("Preview failed");
      const data = await res.json();
      setPreviewCount(data.previewCount);
    } catch (err) {
      console.error(err);
      setError("Couldn't compute a preview.");
    } finally {
      setBusy(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const actions = buildActions();
    if (!hasAnyAction(actions)) {
      setError("Pick at least one action.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          priority: parseInt(priority, 10) || 0,
          enabled: true,
          match: buildMatch(),
          actions,
          applyToExisting,
        }),
      });
      if (!res.ok) throw new Error("Failed to create rule");
      setTextValue("");
      setAmountValue("");
      setAddTag("");
      setSetCategoryId("");
      setExclude(false);
      setMarkTransfer(false);
      setPreviewCount(null);
      close();
      router.refresh();
    } catch (err) {
      console.error(err);
      setError("Couldn't create the rule.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        + New rule
      </Button>
      <FormPanel
        open={open}
        onClose={close}
        title="New rule"
        description="Automatically categorize, tag or exclude transactions that match."
        onSubmit={handleSubmit}
        submitLabel="Create rule"
        submittingLabel="Saving…"
        submitting={busy}
        error={error}
      >
        <FormField label="When">
          <div className="grid grid-cols-2 gap-2">
            <select
              value={field}
              onChange={(e) => {
                const f = e.target.value as Field;
                setField(f);
                setOp(OPS_BY_FIELD[f][0]!.value);
                setPreviewCount(null);
              }}
              className={panelInputClass}
            >
              <option value="merchant">Merchant</option>
              <option value="description">Description</option>
              <option value="amount">Amount</option>
              <option value="account">Account</option>
              <option value="direction">Direction</option>
            </select>
            <select value={op} onChange={(e) => setOp(e.target.value)} className={panelInputClass}>
              {OPS_BY_FIELD[field].map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          {field === "amount" ? (
            <AmountInput value={amountValue} onChange={setAmountValue} />
          ) : field === "account" ? (
            <SearchableSelect
              value={accountValue}
              onChange={setAccountValue}
              buttonPlaceholder="Choose account"
              placeholder="Search accounts…"
              className="w-full"
              options={accounts.map((a) => ({ value: a.id, label: a.name }))}
            />
          ) : field === "direction" ? (
            <select value={directionValue} onChange={(e) => setDirectionValue(e.target.value as "in" | "out")} className={panelInputClass}>
              <option value="out">Money out (spend)</option>
              <option value="in">Money in</option>
            </select>
          ) : (
            <input
              type="text"
              value={textValue}
              onChange={(e) => setTextValue(e.target.value)}
              required
              autoFocus
              placeholder={field === "merchant" ? "Starbucks" : "text to match"}
              className={panelInputClass}
            />
          )}
          <div className="flex items-center gap-3">
            <button type="button" onClick={handlePreview} disabled={busy} className="text-[13px] text-brand disabled:opacity-40">
              Preview matches
            </button>
            {previewCount !== null && (
              <span className="text-[13px] text-text-2 tabular">
                Would affect {previewCount} transaction{previewCount === 1 ? "" : "s"}
              </span>
            )}
          </div>
        </FormField>

        <div className="h-px bg-border" />

        <FormField label="Then">
          <SearchableSelect
            value={setCategoryId}
            onChange={setSetCategoryId}
            buttonPlaceholder="Don't change category"
            placeholder="Search categories…"
            className="w-full"
            options={categories.map((c) => ({ value: c.id, label: `Set category: ${c.name}`, colorSlot: c.colorSlot, indent: c.indent }))}
          />
          <input type="text" value={addTag} onChange={(e) => setAddTag(e.target.value)} placeholder="Add tag (optional)" className={panelInputClass} />
          <div className="flex flex-col gap-3 pt-1">
            <CheckboxField checked={exclude} onChange={setExclude} label="Exclude from budget" />
            <CheckboxField checked={markTransfer} onChange={setMarkTransfer} label="Mark as transfer" />
          </div>
        </FormField>

        <div className="h-px bg-border" />

        <FormField label="Priority" hint="Lower numbers run first.">
          <input type="number" value={priority} onChange={(e) => setPriority(e.target.value)} className={`${panelInputClass} w-24 tabular`} />
        </FormField>
        <CheckboxField checked={applyToExisting} onChange={setApplyToExisting} label="Apply to existing transactions" />
      </FormPanel>
    </>
  );
}
