"use client";

import { type FormEvent, type ReactNode } from "react";
import { SidePanel } from "@/components/ui/SidePanel";
import { cn } from "@/lib/cn";

/** Shared input styling for fields stacked inside a FormPanel. */
export const panelInputClass = "w-full h-9 rounded-control bg-surface-2 border border-border-strong px-2.5 text-sm text-text";

/**
 * The one way every "add" flow opens on web (budget, bill, transaction,
 * rule, income schedule, API token): a right-hand SidePanel -- the same
 * sheet as TransactionDetailPanel -- with a title, stacked fields, and a
 * Save/Cancel footer pinned to the bottom so it's reachable however long
 * the form gets.
 */
export function FormPanel({
  open,
  onClose,
  title,
  description,
  onSubmit,
  submitLabel,
  submittingLabel,
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
  submittingLabel: string;
  submitting: boolean;
  submitDisabled?: boolean;
  error?: string | null;
  children: ReactNode;
}) {
  return (
    <SidePanel open={open} onClose={onClose}>
      <form onSubmit={onSubmit} className="flex flex-col min-h-full">
        <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-4 border-b border-border">
          <div className="flex flex-col gap-1 min-w-0">
            <h2 className="m-0 text-xl font-semibold text-text">{title}</h2>
            {description && <p className="text-[13.5px] text-text-3">{description}</p>}
          </div>
          <button type="button" onClick={onClose} aria-label="Close" title="Close" className="text-text-3 hover:text-text text-lg leading-none">
            ×
          </button>
        </div>

        <div className="flex-1 flex flex-col gap-4 p-5">{children}</div>

        <div className="sticky bottom-0 flex flex-col gap-3 px-5 py-4 border-t border-border bg-raised">
          {error && <p className="text-sm text-negative">{error}</p>}
          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={submitting || submitDisabled}
              className="h-9 px-4 rounded-control bg-brand text-on-brand text-sm font-medium hover:bg-brand-hover disabled:opacity-40"
            >
              {submitting ? submittingLabel : submitLabel}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="h-9 px-4 rounded-control bg-surface border border-border-strong text-sm font-medium text-text hover:bg-sunken"
            >
              Cancel
            </button>
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
