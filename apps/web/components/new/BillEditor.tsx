"use client";

import { useState } from "react";
import { useMutate } from "@/components/new/useMutate";
import { ConfirmButton } from "@/components/new/ConfirmButton";

interface Option {
  id: string;
  name: string;
}

/** "Add a bill": something Tally can't detect on its own, like rent paid by e-transfer. */
export function AddBill({ accounts, categories, today }: { accounts: Option[]; categories: Option[]; today: string }) {
  const { run, busy } = useMutate();
  const [open, setOpen] = useState(false);
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  // Never preselected: the user picks which account pays it.
  const [accountId, setAccountId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [due, setDue] = useState("");
  const cents = Math.round((Number(amount.replace(/[^0-9.]/g, "")) || 0) * 100);
  const ready = description.trim() && cents > 0 && accountId && due;

  if (!open) {
    return (
      <button type="button" className="tn-btn" onClick={() => setOpen(true)}>
        + Add a bill
      </button>
    );
  }
  return (
    <form
      className="tn-card"
      style={{ display: "flex", flexDirection: "column", gap: 14 }}
      onSubmit={async (e) => {
        e.preventDefault();
        if (!ready) return;
        const ok = await run("POST", "/api/recurring-streams", { description: description.trim(), amount: cents, accountId, categoryId: categoryId || null, manualNextDueDate: due }, `${description.trim()} added`);
        if (ok) {
          setOpen(false);
          setDescription("");
          setAmount("");
          setAccountId("");
          setCategoryId("");
          setDue("");
        }
      }}
    >
      <span className="tn-disp" style={{ fontSize: 20, fontWeight: 700 }}>
        Add a bill
      </span>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14 }}>
        <Field label="What is it">
          <input className="tn-input" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Rent" maxLength={120} required autoFocus />
        </Field>
        <Field label="Amount">
          <input className="tn-input" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="$0" required />
        </Field>
        <Field label="Next due">
          <input className="tn-input" type="date" min={today} value={due} onChange={(e) => setDue(e.target.value)} required />
        </Field>
        <Field label="Paid from">
          <select className="tn-input" value={accountId} onChange={(e) => setAccountId(e.target.value)} required>
            <option value="">Pick an account</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Category (optional)">
          <select className="tn-input" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            <option value="">None</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button type="submit" className="tn-btn tn-btn-lime tn-btn-sm" disabled={busy || !ready}>
          Add bill
        </button>
        <button type="button" className="tn-btn tn-btn-sm" onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
    </form>
  );
}

/** A bill or recurring charge's own actions: move its next date, or stop tracking it. */
export function BillActions({ id, name, next, isManual, today }: { id: string; name: string; next: string | null; isManual: boolean; today: string }) {
  const { run, busy } = useMutate();
  const [editing, setEditing] = useState(false);
  const [due, setDue] = useState(next ?? "");

  if (editing) {
    return (
      <form
        style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", paddingBottom: 12 }}
        onSubmit={async (e) => {
          e.preventDefault();
          if (await run("PATCH", `/api/recurring-streams/${id}`, { manualNextDueDate: due || null }, `${name} moved`)) setEditing(false);
        }}
      >
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14 }}>
          <span className="tn-muted">Next due</span>
          <input className="tn-input" type="date" min={today} value={due} onChange={(e) => setDue(e.target.value)} style={{ minHeight: 40 }} />
        </label>
        <button type="submit" className="tn-btn tn-btn-lime tn-btn-sm" disabled={busy}>
          Save
        </button>
        <button type="button" className="tn-btn tn-btn-sm" onClick={() => setEditing(false)}>
          Cancel
        </button>
        <ConfirmButton
          label={isManual ? "Remove bill" : "It won't recur"}
          question={isManual ? `Remove ${name}?` : `Stop tracking ${name}?`}
          confirmLabel={isManual ? "Yes, remove" : "Yes, stop"}
          disabled={busy}
          onConfirm={async () => {
            await run("DELETE", `/api/recurring-streams/${id}`, undefined, `${name} removed`);
          }}
        />
      </form>
    );
  }
  return (
    <button type="button" className="tn-btn tn-btn-sm" onClick={() => setEditing(true)} aria-label={`Edit ${name}`}>
      Edit
    </button>
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
