"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export interface RuleRowData {
  id: string;
  priority: number;
  enabled: boolean;
  matchSummary: string;
  actionsSummary: string;
}

export function RuleRow({ rule }: { rule: RuleRowData }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function toggleEnabled() {
    setBusy(true);
    try {
      const res = await fetch(`/api/rules/${rule.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !rule.enabled }),
      });
      if (!res.ok) throw new Error("Failed to update rule");
      router.refresh();
    } catch (err) {
      console.error(err);
      setBusy(false);
    }
  }

  async function remove() {
    if (!window.confirm("Delete this rule? Transactions it already categorized keep their category.")) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/rules/${rule.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete rule");
      router.refresh();
    } catch (err) {
      console.error(err);
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-border last:border-b-0">
      <span className="font-mono text-xs text-text-3 tabular w-8 flex-none">{rule.priority}</span>
      <div className="flex-1 min-w-0 flex flex-col gap-0.5">
        <span className="text-[15px] text-text truncate">{rule.matchSummary}</span>
        <span className="text-xs text-text-3 truncate">{rule.actionsSummary}</span>
      </div>
      <label className="flex items-center gap-1.5 text-xs text-text-2">
        <input type="checkbox" checked={rule.enabled} onChange={toggleEnabled} disabled={busy} />
        Enabled
      </label>
      <button onClick={remove} disabled={busy} className="text-xs text-text-3 hover:text-negative disabled:opacity-40">
        Delete
      </button>
    </div>
  );
}
