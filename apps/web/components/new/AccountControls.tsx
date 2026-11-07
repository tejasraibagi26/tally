"use client";

import { useState } from "react";
import { useMutate } from "@/components/new/useMutate";
import { ConfirmButton } from "@/components/new/ConfirmButton";

/** Give an account your own name (empty goes back to the bank's). */
export function RenameAccount({ id, name }: { id: string; name: string }) {
  const { run, busy } = useMutate();
  const [open, setOpen] = useState(false);
  const [v, setV] = useState(name);
  if (!open) {
    return (
      <button type="button" className="tn-btn tn-btn-sm" onClick={() => setOpen(true)} aria-label={`Rename ${name}`}>
        Rename
      </button>
    );
  }
  return (
    <form
      style={{ display: "flex", flexWrap: "wrap", gap: 8 }}
      onSubmit={async (e) => {
        e.preventDefault();
        if (await run("PATCH", `/api/accounts/${id}`, { nickname: v.trim() || null }, v.trim() ? "Renamed" : "Back to the bank's name")) setOpen(false);
      }}
    >
      <input className="tn-input" value={v} onChange={(e) => setV(e.target.value)} maxLength={60} aria-label="Account name" style={{ minHeight: 40, width: 220 }} autoFocus />
      <button type="submit" className="tn-btn tn-btn-sm tn-btn-lime" disabled={busy}>
        Save
      </button>
      <button type="button" className="tn-btn tn-btn-sm" onClick={() => setOpen(false)}>
        Cancel
      </button>
    </form>
  );
}

/** A bank connection's own actions: sync now, and disconnect (asks first; history stays). */
export function BankActions({ id, name }: { id: string; name: string }) {
  const { run, busy } = useMutate();
  return (
    <span style={{ display: "inline-flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
      <button type="button" className="tn-btn tn-btn-sm" disabled={busy} onClick={() => run("POST", `/api/items/${id}/sync`, undefined, `Syncing ${name}…`)}>
        {busy ? "Working…" : "Sync now"}
      </button>
      <ConfirmButton
        label="Disconnect"
        question={`Disconnect ${name}? Syncing stops; past transactions stay.`}
        confirmLabel="Yes, disconnect"
        disabled={busy}
        onConfirm={async () => void (await run("DELETE", `/api/items/${id}`, undefined, `${name} disconnected`))}
      />
    </span>
  );
}
