"use client";

import { useState } from "react";
import { useMutate } from "@/components/new/useMutate";

interface Option {
  id: string;
  name: string;
}

/**
 * Add something the bank didn't send: cash, or an account Tally isn't
 * linked to. Same POST /api/transactions as the classic form; the account
 * is never preselected.
 */
export function AddTransaction({ accounts, expense, income, today }: { accounts: Option[]; expense: Option[]; income: Option[]; today: string }) {
  const { run, busy } = useMutate();
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<"expense" | "income">("expense");
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(today);
  const [accountId, setAccountId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const cents = Math.round((Number(amount.replace(/[^0-9.]/g, "")) || 0) * 100);
  const ready = name.trim() && cents > 0 && accountId && date;
  const cats = kind === "expense" ? expense : income;

  if (!open) {
    return (
      <button type="button" className="tn-btn tn-btn-solid" onClick={() => setOpen(true)}>
        + Add a transaction
      </button>
    );
  }
  return (
    <form
      className="tn-card"
      style={{ display: "flex", flexDirection: "column", gap: 14, width: "100%" }}
      onSubmit={async (e) => {
        e.preventDefault();
        if (!ready) return;
        const ok = await run("POST", "/api/transactions", { name: name.trim(), amount: cents, kind, postedDate: date, accountId, categoryId: categoryId || null }, `${name.trim()} added`);
        if (ok) {
          setOpen(false);
          setName("");
          setAmount("");
          setAccountId("");
          setCategoryId("");
          setDate(today);
        }
      }}
    >
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12 }}>
        <span className="tn-disp" style={{ fontSize: 20, fontWeight: 700, marginRight: "auto" }}>
          Add a transaction
        </span>
        <div role="group" aria-label="Kind" style={{ display: "flex", gap: 2, padding: 3, borderRadius: 999, background: "var(--tn-bg)" }}>
          {(["expense", "income"] as const).map((k) => (
            <button
              key={k}
              type="button"
              aria-pressed={kind === k}
              onClick={() => {
                setKind(k);
                setCategoryId("");
              }}
              style={{ minHeight: 36, padding: "0 14px", border: 0, borderRadius: 999, background: kind === k ? "var(--tn-ink)" : "none", color: kind === k ? "var(--tn-bg)" : "var(--tn-muted)", font: "inherit", fontSize: 14, cursor: "pointer" }}
            >
              {k === "expense" ? "Money out" : "Money in"}
            </button>
          ))}
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 14 }}>
        <Field label={kind === "expense" ? "Where" : "From"}>
          <input className="tn-input" value={name} onChange={(e) => setName(e.target.value)} placeholder={kind === "expense" ? "Farmers market" : "Birthday money"} maxLength={200} required autoFocus />
        </Field>
        <Field label="Amount">
          <input className="tn-input" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="$0" required />
        </Field>
        <Field label="Date">
          <input className="tn-input" type="date" max={today} value={date} onChange={(e) => setDate(e.target.value)} required />
        </Field>
        <Field label="Account">
          <select className="tn-input" value={accountId} onChange={(e) => setAccountId(e.target.value)} required>
            <option value="">Pick an account</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Category">
          <select className="tn-input" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            <option value="">Let Tally decide later</option>
            {cats.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button type="submit" className="tn-btn tn-btn-lime tn-btn-sm" disabled={busy || !ready}>
          Add it
        </button>
        <button type="button" className="tn-btn tn-btn-sm" onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 0 }}>
      <span className="tn-muted" style={{ fontSize: 13 }}>
        {label}
      </span>
      {children}
    </label>
  );
}
