"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CalendarDays, Pencil, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { DialogBody, DialogFooter, DialogHeader, DialogTile } from "@/components/ui/Dialog";
import { showToast } from "@/lib/toast";

/** "2026-10-14" → "Oct 14". */
function shortDate(iso: string): string {
  return new Date(iso + "T00:00:00Z").toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

/**
 * The Actions column's edit-next-date control: an icon button that opens the
 * date form in a centered Modal. The form used to be a popover anchored under
 * the button, which the table's scroll container clipped, so reaching Save
 * meant scrolling. The Modal is fixed to the viewport and so never clipped.
 */
export function NextDueDateEditor({
  streamId,
  description,
  detail,
  predictedNextDate,
  manualNextDueDate,
}: {
  streamId: string;
  /** The bill's name, shown in the dialog heading. */
  description: string;
  /** Cadence and amount under the name, e.g. "monthly · $20.99". */
  detail?: string;
  predictedNextDate: string | null;
  manualNextDueDate: string | null;
}) {
  const router = useRouter();
  const titleId = useId();
  const fieldId = useId();
  const [open, setOpen] = useState(false);
  const current = manualNextDueDate ?? predictedNextDate ?? "";
  const [dateInput, setDateInput] = useState(current);
  // Which save is running: the form's, or the reset to the predicted date.
  const [saving, setSaving] = useState<"save" | "reset" | null>(null);
  const [error, setError] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const close = useCallback(() => setOpen(false), []);

  // Modal moves focus to its dialog on open; put it on the date field instead.
  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  async function save(nextManualDate: string | null) {
    setSaving(nextManualDate === null ? "reset" : "save");
    setError(false);
    try {
      const res = await fetch(`/api/recurring-streams/${streamId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ manualNextDueDate: nextManualDate }),
      });
      if (!res.ok) throw new Error("Failed to update next due date");
      setOpen(false);
      const shown = nextManualDate ?? predictedNextDate;
      showToast(shown ? `Next date set to ${shortDate(shown)}` : "Next date cleared");
      router.refresh();
    } catch (err) {
      console.error(err);
      setError(true);
    } finally {
      setSaving(null);
    }
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!dateInput || dateInput === current) return;
    void save(dateInput);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setDateInput(current);
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

      <Modal open={open} onClose={close} width={480} labelledBy={titleId} busy={saving !== null}>
        <form onSubmit={submit}>
          <DialogBody>
            <DialogHeader
              tile={
                <DialogTile tone="neutral">
                  <CalendarDays size={20} strokeWidth={1.75} />
                </DialogTile>
              }
              titleId={titleId}
              title="Edit next date"
              subtitle={detail ? `${description} · ${detail}` : description}
              onClose={close}
            />
            <div className="flex flex-col gap-1.5">
              <label htmlFor={fieldId} className="flex items-center gap-2 text-xs font-medium text-text-2">
                Next charge
                {manualNextDueDate && (
                  <span className="rounded-[6px] border border-brand-border bg-brand-subtle px-1.5 py-0.5 text-[11px] font-medium text-brand">Set by you</span>
                )}
              </label>
              <input
                ref={inputRef}
                id={fieldId}
                type="date"
                value={dateInput}
                disabled={saving !== null}
                aria-invalid={error || undefined}
                aria-describedby={`${fieldId}-help`}
                onChange={(e) => setDateInput(e.target.value)}
                className={`h-9 w-full rounded-control bg-surface border px-3 text-[15px] text-text tabular-nums disabled:opacity-60 ${error ? "border-negative" : "border-border-strong"}`}
              />
              {error ? (
                <p id={`${fieldId}-help`} role="alert" className="m-0 flex items-center gap-1.5 text-[13px] text-negative">
                  <AlertTriangle size={14} strokeWidth={1.75} className="flex-none" />
                  Couldn&apos;t save the date. Check your connection and try again.
                </p>
              ) : (
                predictedNextDate && (
                  <p id={`${fieldId}-help`} className="m-0 text-[13px] text-text-3">
                    {manualNextDueDate ? `Tally predicted ${shortDate(predictedNextDate)}.` : `Tally predicts ${shortDate(predictedNextDate)} from past charges.`}
                  </p>
                )
              )}
            </div>
          </DialogBody>
          <DialogFooter
            left={
              manualNextDueDate && (
                <Button type="button" variant="ghost" size="sm" className="text-text-2" loading={saving === "reset"} disabled={saving === "save"} onClick={() => void save(null)}>
                  {saving !== "reset" && <RotateCcw size={14} strokeWidth={1.75} />}
                  {predictedNextDate ? `Use ${shortDate(predictedNextDate)} instead` : "Clear my date"}
                </Button>
              )
            }
          >
            <Button type="button" variant="ghost" disabled={saving !== null} onClick={close}>
              Cancel
            </Button>
            <Button type="submit" loading={saving === "save"} disabled={!dateInput || dateInput === current || saving === "reset"}>
              Save date
            </Button>
          </DialogFooter>
        </form>
      </Modal>
    </>
  );
}
