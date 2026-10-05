"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";

/**
 * The Actions column's edit-next-date control: an icon button that opens the
 * date form in a centered Modal. The form used to be a popover anchored under
 * the button, which the table's scroll container clipped, so reaching Save
 * meant scrolling. The Modal is fixed to the viewport and so never clipped.
 */
export function NextDueDateEditor({
  streamId,
  description,
  predictedNextDate,
  manualNextDueDate,
}: {
  streamId: string;
  /** The bill's name, shown in the dialog heading. */
  description: string;
  predictedNextDate: string | null;
  manualNextDueDate: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [dateInput, setDateInput] = useState(manualNextDueDate ?? predictedNextDate ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  // Stable identity: Modal refocuses its dialog whenever onClose changes, which would pull focus out of the date field on every keystroke.
  const close = useCallback(() => setOpen(false), []);

  // Modal moves focus to its dialog on open; put it back on the date field once that has happened.
  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  async function save(nextManualDate: string | null) {
    setSaving(true);
    setError(false);
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
      setError(true);
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
    <>
      <button
        type="button"
        onClick={() => {
          setDateInput(manualNextDueDate ?? predictedNextDate ?? "");
          setError(false);
          setOpen(true);
        }}
        title="Edit next date"
        aria-label="Edit next date"
        aria-haspopup="dialog"
        className="w-7 h-7 flex-none rounded-control flex items-center justify-center text-text-3 hover:text-text hover:bg-sunken"
      >
        <Pencil size={14} strokeWidth={1.75} />
      </button>

      <Modal open={open} onClose={close} width={480}>
        <form onSubmit={submit} className="p-6 flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <h2 className="text-xl font-semibold text-text m-0">Edit next date</h2>
            <p className="m-0 text-[15px] text-text-2 truncate">{description}</p>
          </div>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium uppercase tracking-wide text-text-3">Next date</span>
            <input
              ref={inputRef}
              type="date"
              value={dateInput}
              onChange={(e) => setDateInput(e.target.value)}
              className="h-10 w-full rounded-control bg-surface-2 border border-border-strong px-3 text-sm text-text"
            />
          </label>
          {error && <p className="m-0 text-[13px] text-negative">Couldn&apos;t save the date. Try again.</p>}
          {manualNextDueDate && (
            <button
              type="button"
              className="text-[13px] text-text-3 hover:text-negative disabled:opacity-40 text-left self-start"
              disabled={saving}
              onClick={() => void save(null)}
            >
              Clear override (go back to auto-detected)
            </button>
          )}
          <div className="flex items-center justify-end gap-3 pt-2">
            <Button type="button" variant="ghost" disabled={saving} onClick={close}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving || !dateInput}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
