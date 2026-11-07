"use client";

import Link from "next/link";
import { useState } from "react";
import { formatCents } from "@tally/core/money";
import { useMutate } from "@/components/new/useMutate";
import { ConfirmButton } from "@/components/new/ConfirmButton";

export interface BudgetRowData {
  categoryId: string;
  name: string;
  status: string;
  statusColor: string;
  barColor: string;
  /** 0–100 of the bar filled. */
  pct: number;
  /** 0–100 where an even pace would be today; null when it doesn't apply. */
  pacePct: number | null;
  spend: number;
  available: number;
  amount: number;
  over: boolean;
  rolloverEnabled: boolean;
  isFixedAmount: boolean;
}

function dollars(cents: number): string {
  return formatCents(Math.round(cents / 100) * 100).replace(/\.00$/, "");
}
function toCents(v: string): number | null {
  const n = Number(v.replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) && v.trim() !== "" ? Math.round(n * 100) : null;
}

const label = { fontSize: 13, color: "var(--tn-muted)" } as const;

/** The month's budgets, each editable in place, plus "Add a budget". */
export function BudgetEditor({ month, rows, categories }: { month: string; rows: BudgetRowData[]; categories: { id: string; name: string }[] }) {
  const [editing, setEditing] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const free = categories.filter((c) => !rows.some((r) => r.categoryId === c.id));

  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      {rows.map((r) =>
        editing === r.categoryId ? (
          <EditRow key={r.categoryId} month={month} row={r} onDone={() => setEditing(null)} />
        ) : (
          <div
            key={r.categoryId}
            style={{ display: "grid", gridTemplateColumns: "minmax(140px, 1fr) minmax(140px, 2fr) auto auto", gap: "8px 24px", alignItems: "center", padding: "16px 4px", borderTop: "1px solid var(--tn-line)" }}
          >
            <Link href={`/new/activity?category=${r.categoryId}`} style={{ minWidth: 0, color: "var(--tn-ink)", textDecoration: "none" }}>
              <div style={{ fontSize: 16, fontWeight: 500 }}>{r.name}</div>
              <div style={{ fontSize: 13, color: r.statusColor }}>{r.status}</div>
            </Link>
            <div className="tn-bar" aria-hidden="true">
              <b style={{ width: `${r.pct}%`, background: r.barColor }} />
              {r.pacePct != null && <i style={{ left: `${r.pacePct}%` }} />}
            </div>
            <div className="tn-disp" style={{ fontSize: 20, fontWeight: 700, textAlign: "right", whiteSpace: "nowrap" }}>
              <span className="money" style={{ color: r.over ? "#ff9c8c" : undefined }}>
                {dollars(r.spend)}
              </span>{" "}
              <span className="tn-faint money" style={{ fontSize: 15 }}>
                / {dollars(r.available)}
              </span>
            </div>
            <button type="button" className="tn-btn tn-btn-sm" onClick={() => setEditing(r.categoryId)} aria-label={`Edit ${r.name} budget`}>
              Edit
            </button>
          </div>
        ),
      )}

      <div style={{ paddingTop: 16, borderTop: "1px solid var(--tn-line)" }}>
        {adding ? (
          <AddRow month={month} categories={free} onDone={() => setAdding(false)} />
        ) : (
          <button type="button" className="tn-btn" onClick={() => setAdding(true)} disabled={free.length === 0}>
            + Add a budget
          </button>
        )}
      </div>
    </div>
  );
}

function EditRow({ month, row, onDone }: { month: string; row: BudgetRowData; onDone: () => void }) {
  const { run, busy } = useMutate();
  const [amount, setAmount] = useState(String(row.amount / 100));
  const [fixed, setFixed] = useState(row.isFixedAmount);
  const [rollover, setRollover] = useState(row.rolloverEnabled);
  const cents = toCents(amount);

  return (
    <form
      className="tn-card"
      style={{ display: "flex", flexDirection: "column", gap: 14, margin: "8px 0" }}
      onSubmit={async (e) => {
        e.preventDefault();
        if (cents == null) return;
        if (await run("PUT", "/api/budgets", { month, categoryId: row.categoryId, amount: cents, rolloverEnabled: rollover, isFixedAmount: fixed }, `${row.name} saved`)) onDone();
      }}
    >
      <span className="tn-disp" style={{ fontSize: 20, fontWeight: 700 }}>
        {row.name}
      </span>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "flex-end" }}>
        <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span style={label}>Each month</span>
          <input className="tn-input" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} style={{ width: 160 }} autoFocus />
        </label>
        <Toggle checked={fixed} onChange={setFixed} label="Fixed bill (like rent)" />
        <Toggle checked={rollover} onChange={setRollover} label="Carry leftovers into next month" />
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
        <button type="submit" className="tn-btn tn-btn-lime tn-btn-sm" disabled={busy || cents == null}>
          Save
        </button>
        <button type="button" className="tn-btn tn-btn-sm" onClick={onDone}>
          Cancel
        </button>
        <span style={{ marginLeft: "auto" }}>
          <ConfirmButton
            label="Remove budget"
            question={`Remove the ${row.name} budget for this month?`}
            disabled={busy}
            onConfirm={async () => {
              if (await run("DELETE", "/api/budgets", { month, categoryId: row.categoryId }, `${row.name} budget removed`)) onDone();
            }}
          />
        </span>
      </div>
    </form>
  );
}

function AddRow({ month, categories, onDone }: { month: string; categories: { id: string; name: string }[]; onDone: () => void }) {
  const { run, busy } = useMutate();
  const [categoryId, setCategoryId] = useState("");
  const [amount, setAmount] = useState("");
  const [fixed, setFixed] = useState(false);
  const cents = toCents(amount);

  return (
    <form
      className="tn-card"
      style={{ display: "flex", flexDirection: "column", gap: 14 }}
      onSubmit={async (e) => {
        e.preventDefault();
        if (!categoryId || cents == null) return;
        const name = categories.find((c) => c.id === categoryId)?.name ?? "Budget";
        if (await run("PUT", "/api/budgets", { month, categoryId, amount: cents, rolloverEnabled: false, isFixedAmount: fixed }, `${name} budget added`)) onDone();
      }}
    >
      <span className="tn-disp" style={{ fontSize: 20, fontWeight: 700 }}>
        New budget
      </span>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "flex-end" }}>
        <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span style={label}>Category</span>
          <select className="tn-input" value={categoryId} onChange={(e) => setCategoryId(e.target.value)} style={{ minWidth: 220 }} required>
            <option value="">Pick a category</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span style={label}>Each month</span>
          <input className="tn-input" inputMode="decimal" placeholder="$0" value={amount} onChange={(e) => setAmount(e.target.value)} style={{ width: 160 }} required />
        </label>
        <Toggle checked={fixed} onChange={setFixed} label="Fixed bill (like rent)" />
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button type="submit" className="tn-btn tn-btn-lime tn-btn-sm" disabled={busy || !categoryId || cents == null}>
          Add budget
        </button>
        <button type="button" className="tn-btn tn-btn-sm" onClick={onDone}>
          Cancel
        </button>
      </div>
    </form>
  );
}

export function Toggle({ checked, onChange, label: text }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label style={{ display: "inline-flex", alignItems: "center", gap: 10, minHeight: 48, cursor: "pointer", fontSize: 14 }}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} style={{ width: 18, height: 18, accentColor: "#c9f26b" }} />
      {text}
    </label>
  );
}
