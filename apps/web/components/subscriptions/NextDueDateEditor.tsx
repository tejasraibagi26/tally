"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/Button";

/**
 * The Actions column's edit-next-date control — a self-contained icon
 * button + popover (same anchor/click-outside/Escape pattern as
 * components/plaid/ItemActionsMenu.tsx), rather than an inline form in the
 * "Next date" cell itself: that used to overflow into the Status/Actions
 * columns next to it since the edit form (date input + Save + Cancel) is
 * wider than the column, and a CSS grid doesn't clip or reflow siblings for
 * an overflowing cell.
 */
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
  const [open, setOpen] = useState(false);
  const [dateInput, setDateInput] = useState(manualNextDueDate ?? predictedNextDate ?? "");
  const [saving, setSaving] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false);
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  async function save(nextManualDate: string | null) {
    setSaving(true);
    try {
      const res = await fetch(`/api/recurring-streams/${streamId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ manualNextDueDate: nextManualDate }),
      });
      if (!res.ok) throw new Error("Failed to update next due date");
      setOpen(false);
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

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => {
          setDateInput(manualNextDueDate ?? predictedNextDate ?? "");
          setOpen((v) => !v);
        }}
        title="Edit next date"
        aria-label="Edit next date"
        aria-haspopup="true"
        aria-expanded={open}
        className="w-7 h-7 flex-none rounded-control flex items-center justify-center text-text-3 hover:text-text hover:bg-sunken"
      >
        <Pencil size={14} strokeWidth={1.75} />
      </button>

      {open && (
        <form
          onSubmit={submit}
          className="absolute right-0 top-full mt-1 z-20 w-64 bg-surface border border-border rounded-control shadow-overlay p-3 flex flex-col gap-2.5"
        >
          <span className="text-xs font-medium uppercase tracking-wide text-text-3">Next date</span>
          <input
            type="date"
            autoFocus
            value={dateInput}
            onChange={(e) => setDateInput(e.target.value)}
            className="h-9 w-full rounded-control bg-surface-2 border border-border-strong px-2 text-sm text-text"
          />
          <div className="flex items-center gap-2">
            <Button type="submit" size="sm" disabled={saving} className="flex-1">
              {saving ? "Saving…" : "Save"}
            </Button>
            <Button type="button" variant="ghost" size="sm" disabled={saving} onClick={() => setOpen(false)}>
              Cancel
            </Button>
          </div>
          {manualNextDueDate && (
            <button
              type="button"
              className="text-xs text-text-3 hover:text-negative disabled:opacity-40 text-left"
              disabled={saving}
              onClick={() => void save(null)}
            >
              Clear override (go back to auto-detected)
            </button>
          )}
        </form>
      )}
    </div>
  );
}
