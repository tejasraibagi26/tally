"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { SearchableSelect } from "@/components/ui/SearchableSelect";

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
      router.refresh();
    } catch (err) {
      console.error(err);
      setError("Couldn't create the rule.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 p-4">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm text-text-2">When</span>
        <select
          value={field}
          onChange={(e) => {
            const f = e.target.value as Field;
            setField(f);
            setOp(OPS_BY_FIELD[f][0]!.value);
          }}
          className="h-9 rounded-control bg-surface-2 border border-border-strong px-2 text-sm text-text"
        >
          <option value="merchant">Merchant</option>
          <option value="description">Description</option>
          <option value="amount">Amount</option>
          <option value="account">Account</option>
          <option value="direction">Direction</option>
        </select>
        <select value={op} onChange={(e) => setOp(e.target.value)} className="h-9 rounded-control bg-surface-2 border border-border-strong px-2 text-sm text-text">
          {OPS_BY_FIELD[field].map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>

        {field === "amount" ? (
          <div className="flex items-center gap-1">
            <span className="text-text-3 text-sm">$</span>
            <input
              type="number"
              step="0.01"
              min="0"
              value={amountValue}
              onChange={(e) => setAmountValue(e.target.value)}
              required
              className="w-24 h-9 rounded-control bg-surface-2 border border-border-strong px-2 text-sm text-text tabular"
            />
          </div>
        ) : field === "account" ? (
          <SearchableSelect
            value={accountValue}
            onChange={setAccountValue}
            buttonPlaceholder="Choose account"
            placeholder="Search accounts…"
            className="w-56"
            options={accounts.map((a) => ({ value: a.id, label: a.name }))}
          />
        ) : field === "direction" ? (
          <select value={directionValue} onChange={(e) => setDirectionValue(e.target.value as "in" | "out")} className="h-9 rounded-control bg-surface-2 border border-border-strong px-2 text-sm text-text">
            <option value="out">Money out (spend)</option>
            <option value="in">Money in</option>
          </select>
        ) : (
          <input
            type="text"
            value={textValue}
            onChange={(e) => setTextValue(e.target.value)}
            required
            placeholder={field === "merchant" ? "Starbucks" : "text to match"}
            className="flex-1 min-w-[160px] h-9 rounded-control bg-surface-2 border border-border-strong px-2 text-sm text-text"
          />
        )}
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm text-text-2">Then</span>
        <SearchableSelect
          value={setCategoryId}
          onChange={setSetCategoryId}
          buttonPlaceholder="Don't change category"
          placeholder="Search categories…"
          className="w-56"
          options={categories.map((c) => ({ value: c.id, label: `Set category: ${c.name}`, colorSlot: c.colorSlot, indent: c.indent }))}
        />
        <input
          type="text"
          value={addTag}
          onChange={(e) => setAddTag(e.target.value)}
          placeholder="Add tag (optional)"
          className="w-40 h-9 rounded-control bg-surface-2 border border-border-strong px-2 text-sm text-text"
        />
        <label className="flex items-center gap-1.5 text-sm text-text-2">
          <input type="checkbox" checked={exclude} onChange={(e) => setExclude(e.target.checked)} />
          Exclude from budget
        </label>
        <label className="flex items-center gap-1.5 text-sm text-text-2">
          <input type="checkbox" checked={markTransfer} onChange={(e) => setMarkTransfer(e.target.checked)} />
          Mark as transfer
        </label>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <label className="flex items-center gap-1.5 text-sm text-text-2">
          Priority
          <input
            type="number"
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
            className="w-16 h-8 rounded-control bg-surface-2 border border-border-strong px-2 text-sm text-text tabular"
          />
          <span className="text-xs text-text-3">(lower runs first)</span>
        </label>
        <label className="flex items-center gap-1.5 text-sm text-text-2">
          <input type="checkbox" checked={applyToExisting} onChange={(e) => setApplyToExisting(e.target.checked)} />
          Apply to existing transactions
        </label>

        <Button type="button" variant="secondary" size="sm" onClick={handlePreview} disabled={busy}>
          Preview
        </Button>
        {previewCount !== null && (
          <span className="text-sm text-text-2 tabular">
            Would affect {previewCount} transaction{previewCount === 1 ? "" : "s"}
          </span>
        )}
        <Button type="submit" size="sm" disabled={busy} className="ml-auto">
          {busy ? "Saving…" : "Create rule"}
        </Button>
      </div>

      {error && <span className="text-sm text-negative">{error}</span>}
    </form>
  );
}
