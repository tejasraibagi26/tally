"use client";

import { type FormEvent, type ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import { SidePanel } from "@/components/ui/SidePanel";
import { Button } from "@/components/ui/Button";
import { DialogHeader, DialogNote } from "@/components/ui/Dialog";
import { cn } from "@/lib/cn";

/** Shared input styling for fields stacked inside a FormPanel. */
export const panelInputClass =
  "w-full h-9 rounded-control bg-surface border border-border-strong px-3 text-[15px] text-text focus:outline-none focus:ring-2 focus:ring-info disabled:opacity-60";

/**
 * The one way every "add" flow opens on web (budget, bill, transaction,
 * rule, income schedule, API token): a right-hand SidePanel -- the same
 * sheet as TransactionDetailPanel -- built like a dialog that slides in:
 * DialogHeader, stacked fields, and a footer pinned to the bottom with
 * Cancel then the primary on the right, so it's reachable however long the
 * form gets. Locked while submitting; failures show above the actions.
 */
export function FormPanel({
  open,
  onClose,
  title,
  description,
  onSubmit,
  submitLabel,
  submitting,
  submitDisabled,
  error,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: ReactNode;
  onSubmit: (e: FormEvent) => void;
  submitLabel: string;
  submitting: boolean;
  submitDisabled?: boolean;
  /** Shown above the actions with an icon; the primary becomes "Try again". */
  error?: string | null;
  children: ReactNode;
}) {
  return (
    <SidePanel open={open} onClose={onClose} dismissible={!submitting}>
      <form onSubmit={onSubmit} className="flex flex-col min-h-full" aria-busy={submitting || undefined}>
        <div className="px-5 pt-5 pb-4 border-b border-border">
          <DialogHeader title={title} subtitle={description} onClose={submitting ? undefined : onClose} />
        </div>

        <fieldset disabled={submitting} className="flex-1 flex flex-col gap-4 p-5 m-0 border-0 min-w-0">
          {children}
        </fieldset>

        <div className="sticky bottom-0 flex flex-col gap-3 px-5 py-4 border-t border-border bg-raised">
          {error && (
            <DialogNote tone="negative" role="alert" icon={<AlertTriangle size={16} strokeWidth={1.75} className="flex-none mt-0.5" />}>
              {error}
            </DialogNote>
          )}
          <div className="flex items-center justify-end gap-3">
            <Button type="button" variant="ghost" onClick={onClose} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" loading={submitting} disabled={submitDisabled}>
              {error ? "Try again" : submitLabel}
            </Button>
          </div>
        </div>
      </form>
    </SidePanel>
  );
}

/** A labelled field row inside a FormPanel. */
export function FormField({ label, hint, children, className }: { label: string; hint?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <span className="text-[13px] font-medium text-text-2">{label}</span>
      {children}
      {hint && <span className="text-xs text-text-3">{hint}</span>}
    </div>
  );
}

/** "$" prefix + amount input, full width. */
export function AmountInput({ value, onChange, autoFocus }: { value: string; onChange: (v: string) => void; autoFocus?: boolean }) {
  return (
    <div className="relative">
      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-3 text-sm pointer-events-none">$</span>
      <input
        type="number"
        step="0.01"
        min="0"
        placeholder="0.00"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required
        autoFocus={autoFocus}
        className={cn(panelInputClass, "pl-6 tabular")}
      />
    </div>
  );
}

/** Checkbox with a title and an optional explanatory line. */
export function CheckboxField({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  hint?: string;
}) {
  return (
    <label className="flex items-start gap-2.5 cursor-pointer">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-[3px]" />
      <span className="flex flex-col gap-0.5">
        <span className="text-sm text-text">{label}</span>
        {hint && <span className="text-xs text-text-3">{hint}</span>}
      </span>
    </label>
  );
}
