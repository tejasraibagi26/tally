"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Switch } from "@/components/ui/Switch";
import { useConfirmAction } from "@/components/ui/useConfirmAction";

export interface RuleRowData {
  id: string;
  priority: number;
  enabled: boolean;
  matchSummary: string;
  actionsSummary: string;
}

/**
 * The row's columns, shared with the header the Rules page draws above the
 * scroll area so the two line up.
 */
export const RULE_COLUMNS = "grid grid-cols-[32px_minmax(0,1fr)_64px_60px] gap-x-3 items-center px-4";

export function RuleRow({ rule }: { rule: RuleRowData }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  // The refresh is part of the work: holding the row disabled until the
  // server's new value arrives keeps the switch from flicking back to the
  // old state, and keeps `saving` from being left on forever.
  const [refreshing, startRefresh] = useTransition();
  const busy = saving || refreshing;
  const { confirm: confirmAction, dialog: confirmDialog } = useConfirmAction();

  async function setEnabled(next: boolean) {
    setSaving(true);
    try {
      const res = await fetch(`/api/rules/${rule.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: next }),
      });
      if (!res.ok) throw new Error("Failed to update rule");
      startRefresh(() => router.refresh());
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  }

  function remove() {
    confirmAction({
      title: "Delete this rule?",
      description: <p className="m-0">Transactions it already categorized keep their category.</p>,
      confirmLabel: "Delete rule",
      failure: "Couldn't delete this rule. Check your connection and try again.",
      run: async () => {
        const res = await fetch(`/api/rules/${rule.id}`, { method: "DELETE" });
        if (!res.ok) throw new Error("Failed to delete rule");
        router.refresh();
      },
    });
  }

  return (
    <div className={`${RULE_COLUMNS} py-3 border-b border-border last:border-b-0`}>
      <span className="font-mono text-xs text-text-3 tabular">{rule.priority}</span>
      <div className="min-w-0 flex flex-col gap-0.5">
        <span className="text-[15px] text-text truncate">{rule.matchSummary}</span>
        <span className="text-xs text-text-3 truncate">{rule.actionsSummary}</span>
      </div>
      <Switch checked={rule.enabled} onChange={setEnabled} disabled={busy} label={rule.enabled ? "Disable this rule" : "Enable this rule"} />
      <button onClick={remove} disabled={busy} className="text-xs text-text-3 hover:text-negative disabled:opacity-40 text-left">
        Delete
      </button>
      {confirmDialog}
    </div>
  );
}
