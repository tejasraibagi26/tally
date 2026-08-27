"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";

export function NextDueDateEditor({
  streamId,
  predictedNextDate,
  manualNextDueDate,
}: {
  streamId: string;
  predictedNextDate: string | null;
  manualNextDueDate: string | null;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [dateInput, setDateInput] = useState(manualNextDueDate ?? predictedNextDate ?? "");
  const [saving, setSaving] = useState(false);

  async function save(manualNextDueDate: string | null) {
    setSaving(true);
    try {
      const res = await fetch(`/api/recurring-streams/${streamId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ manualNextDueDate }),
      });
      if (!res.ok) throw new Error("Failed to update next due date");
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
    if (!dateInput) return;
    void save(dateInput);
  }

  if (editing) {
    return (
      <form onSubmit={submit} className="flex items-center gap-1.5 flex-nowrap">
        <input
          type="date"
          autoFocus
          value={dateInput}
          onChange={(e) => setDateInput(e.target.value)}
          className="h-8 w-[136px] flex-none rounded-control bg-surface-2 border border-border-strong px-2 text-xs text-text"
        />
        <Button type="submit" size="sm" disabled={saving} className="flex-none px-2">
          {saving ? "…" : "Save"}
        </Button>
        <Button type="button" variant="ghost" size="sm" disabled={saving} onClick={() => setEditing(false)} className="flex-none px-2">
          Cancel
        </Button>
      </form>
    );
  }

  if (manualNextDueDate) {
    return (
      <div className="flex items-center gap-2 flex-nowrap whitespace-nowrap">
        <span className="font-mono text-xs text-text-2 tabular flex-none">{manualNextDueDate}</span>
        <button type="button" className="text-xs text-brand disabled:opacity-40 flex-none" disabled={saving} onClick={() => setEditing(true)}>
          Edit
        </button>
        <button
          type="button"
          className="text-xs text-text-3 hover:text-negative disabled:opacity-40 flex-none"
          disabled={saving}
          onClick={() => void save(null)}
        >
          Reset
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 flex-nowrap whitespace-nowrap">
      <span className="font-mono text-xs text-text-2 tabular flex-none">{predictedNextDate ?? "—"}</span>
      <button type="button" className="text-xs text-brand disabled:opacity-40 flex-none" disabled={saving} onClick={() => setEditing(true)}>
        Override
      </button>
    </div>
  );
}
