"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Check, X } from "lucide-react";
import { accountDisplayName } from "@tally/core/accountName";

// Inline nickname editor -- renders the effective display name (nickname if
// set, otherwise the real Plaid name) with a small edit affordance, used
// anywhere an account name appears (Accounts page, Credit cards page).
// Mirrors CreditLimitEditor.tsx's toggle-to-inline-form pattern.
export function AccountNicknameEditor({
  accountId,
  name,
  nickname,
  className,
}: {
  accountId: string;
  name: string;
  nickname: string | null;
  className?: string;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [input, setInput] = useState(nickname ?? "");
  const [saving, setSaving] = useState(false);

  async function save(next: string | null) {
    setSaving(true);
    try {
      const res = await fetch(`/api/accounts/${accountId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nickname: next }),
      });
      if (!res.ok) throw new Error("Failed to update nickname");
      setEditing(false);
      router.refresh();
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    void save(input.trim() || null);
  }

  if (editing) {
    return (
      <form onSubmit={submit} className={className}>
        <div className="flex items-center gap-1.5">
          <input
            autoFocus
            placeholder={name}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            maxLength={60}
            className="h-8 flex-1 min-w-0 rounded-control bg-surface-2 border border-border-strong px-2 text-sm text-text"
          />
          <button type="submit" disabled={saving} className="text-positive disabled:opacity-40 flex-none" aria-label="Save nickname">
            <Check size={16} />
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => {
              setEditing(false);
              setInput(nickname ?? "");
            }}
            className="text-text-3 disabled:opacity-40 flex-none"
            aria-label="Cancel"
          >
            <X size={16} />
          </button>
        </div>
      </form>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      className={`group/nickname flex items-center gap-1.5 min-w-0 text-left ${className ?? ""}`}
    >
      <span className="truncate">{accountDisplayName(name, nickname)}</span>
      <Pencil size={12} className="text-text-3 flex-none opacity-0 group-hover/nickname:opacity-100 transition-opacity" />
    </button>
  );
}
