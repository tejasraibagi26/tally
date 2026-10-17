"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Check, X } from "lucide-react";
import { showToast } from "@/lib/toast";

// The transaction panel's merchant title, renameable for a synced row. A
// rename covers every transaction from the same original merchant, now and
// on future syncs (lib/merchantRenames.ts). Same toggle-to-inline-form
// pattern as AccountNicknameEditor.tsx.
export function MerchantNameEditor({ transactionId, display, renameable }: { transactionId: string; display: string; renameable: boolean }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [input, setInput] = useState(display);
  const [rename, setRename] = useState<{ original: string; displayName: string | null } | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    setEditing(false);
    setRename(null);
  }, [transactionId]);

  function open() {
    setInput(display);
    setError(false);
    setEditing(true);
    fetch(`/api/transactions/${transactionId}/merchant-name`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setRename(d))
      .catch(() => {});
  }

  async function save(next: string | null, opts: { undo?: string | null } = {}) {
    setSaving(true);
    setError(false);
    try {
      const res = await fetch(`/api/transactions/${transactionId}/merchant-name`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName: next }),
      });
      if (!res.ok) throw new Error("Rename failed");
      const d: { original: string; displayName: string; count: number } = await res.json();
      setEditing(false);
      router.refresh();
      if ("undo" in opts) {
        const undo = opts.undo ?? null;
        const what = d.count === 1 ? "1 transaction" : `${d.count} transactions`;
        showToast(d.displayName === d.original ? `Back to ${d.original} on ${what}` : `Renamed to ${d.displayName} on ${what}`, "positive", {
          label: "Undo",
          onPress: () => void save(undo),
        });
      }
    } catch {
      setError(true);
    } finally {
      setSaving(false);
    }
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const next = input.trim();
    if (!next || next === display) {
      setEditing(false);
      return;
    }
    void save(next, { undo: rename?.displayName ?? null });
  }

  if (!renameable) return <span className="text-[16px] font-semibold text-text truncate">{display}</span>;

  if (editing) {
    return (
      <form onSubmit={submit} className="flex flex-col gap-1">
        <div className="flex items-center gap-1.5">
          <input
            autoFocus
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                e.stopPropagation();
                setEditing(false);
              }
            }}
            maxLength={80}
            aria-label="Merchant name"
            className="h-8 flex-1 min-w-0 rounded-control bg-surface-2 border border-border-strong px-2 text-[15px] font-semibold text-text"
          />
          <button type="submit" disabled={saving} className="text-positive disabled:opacity-40 flex-none" aria-label="Save merchant name" title="Save">
            <Check size={16} />
          </button>
          <button type="button" disabled={saving} onClick={() => setEditing(false)} className="text-text-3 disabled:opacity-40 flex-none" aria-label="Cancel" title="Cancel">
            <X size={16} />
          </button>
        </div>
        <span className="text-[12px] text-text-3">
          {error ? (
            <span className="text-negative">Couldn&apos;t rename. Try again.</span>
          ) : rename ? (
            <>
              Renames every transaction from <b className="font-semibold text-text-2">{rename.original}</b>.
              {rename.displayName && (
                <>
                  {" "}
                  <button type="button" disabled={saving} onClick={() => void save(null, { undo: rename.displayName })} className="font-semibold text-brand hover:underline disabled:opacity-40">
                    Use {rename.original}
                  </button>
                </>
              )}
            </>
          ) : (
            "Renames every transaction from this merchant."
          )}
        </span>
      </form>
    );
  }

  return (
    <button type="button" onClick={open} className="group/merchant flex items-center gap-1.5 min-w-0 text-left" title="Rename merchant">
      <span className="text-[16px] font-semibold text-text truncate">{display}</span>
      <Pencil size={12} className="text-text-3 flex-none opacity-0 group-hover/merchant:opacity-100 group-focus-visible/merchant:opacity-100 transition-opacity" />
    </button>
  );
}
