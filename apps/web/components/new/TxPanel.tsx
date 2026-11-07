"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { showToast } from "@/lib/toast";
import { ConfirmButton } from "@/components/new/ConfirmButton";

interface Option {
  id: string;
  name: string;
}

/**
 * The selected transaction's actions in the new Activity view: pick a
 * category (and offer to always file the merchant there), confirm a
 * guessed one, or leave it out of totals. Same PATCH the classic panel uses.
 */
export function TxPanel({
  id,
  merchant,
  categoryId,
  quick,
  all,
  reviewed,
  excluded,
  isManual,
}: {
  id: string;
  merchant: string;
  categoryId: string | null;
  quick: Option[];
  all: Option[];
  reviewed: boolean;
  excluded: boolean;
  isManual: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [picked, setPicked] = useState<string | null>(categoryId);
  const [askAlways, setAskAlways] = useState<Option | null>(null);

  async function patch(body: Record<string, unknown>): Promise<boolean> {
    setBusy(true);
    try {
      const res = await fetch(`/api/transactions/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!res.ok) {
        showToast("Couldn't save that. Try again.", "negative");
        return false;
      }
      router.refresh();
      return true;
    } finally {
      setBusy(false);
    }
  }

  async function pick(opt: Option) {
    if (opt.id === picked) return;
    const before = picked;
    setPicked(opt.id);
    if (await patch({ categoryId: opt.id, reviewed: true })) setAskAlways(opt);
    else setPicked(before);
  }

  const options = quick.some((q) => q.id === picked) || !picked ? quick : [...quick, all.find((a) => a.id === picked)!].filter(Boolean);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <span className="tn-muted" style={{ fontSize: 14 }}>
          Category
        </span>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {options.map((o) => (
            <button key={o.id} type="button" className="tn-chip" style={{ minHeight: 40 }} aria-pressed={o.id === picked} disabled={busy} onClick={() => pick(o)}>
              {o.name}
            </button>
          ))}
          <label style={{ position: "relative" }}>
            <span style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }}>Another category</span>
            <select
              className="tn-chip"
              style={{ minHeight: 40, appearance: "none", paddingRight: 16 }}
              value=""
              disabled={busy}
              onChange={(e) => {
                const o = all.find((a) => a.id === e.target.value);
                if (o) pick(o);
              }}
            >
              <option value="">Other…</option>
              {all.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {askAlways && (
        <div className="tn-card-line" style={{ display: "flex", flexDirection: "column", gap: 10, padding: 16 }}>
          <span>
            Always file <strong>{merchant}</strong> under <strong>{askAlways.name}</strong>?
          </span>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              type="button"
              className="tn-btn tn-btn-lime tn-btn-sm"
              disabled={busy}
              onClick={async () => {
                if (await patch({ categoryId: askAlways.id, alwaysCategorizeMerchant: true })) {
                  showToast(`${merchant} will always go under ${askAlways.name}`);
                  setAskAlways(null);
                }
              }}
            >
              Yes, always
            </button>
            <button type="button" className="tn-btn tn-btn-sm" onClick={() => setAskAlways(null)}>
              Just this once
            </button>
          </div>
        </div>
      )}

      {!reviewed && !askAlways && picked && (
        <button type="button" className="tn-btn tn-btn-sm" style={{ alignSelf: "flex-start" }} disabled={busy} onClick={() => patch({ reviewed: true })}>
          Looks right
        </button>
      )}

      <button
        type="button"
        disabled={busy}
        onClick={() => patch({ excluded: !excluded })}
        style={{ alignSelf: "flex-start", minHeight: 44, background: "none", border: 0, padding: 0, color: "var(--tn-muted)", font: "inherit", fontSize: 14, cursor: "pointer", textDecoration: "underline", textUnderlineOffset: 3 }}
      >
        {excluded ? "Count it in totals again" : "Not a real expense? Leave it out of totals"}
      </button>

      {isManual && (
        <ConfirmButton
          label="Delete this transaction"
          question={`Delete ${merchant}? This can't be undone.`}
          confirmLabel="Yes, delete"
          disabled={busy}
          onConfirm={async () => {
            setBusy(true);
            try {
              const res = await fetch(`/api/transactions/${id}`, { method: "DELETE" });
              if (!res.ok) {
                showToast("Couldn't delete that. Try again.", "negative");
                return;
              }
              showToast(`${merchant} deleted`);
              router.push("/new/activity");
              router.refresh();
            } finally {
              setBusy(false);
            }
          }}
        />
      )}
    </div>
  );
}
