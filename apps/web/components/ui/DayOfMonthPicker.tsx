"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/cn";

/** "18th", "Last day", "Not set": day 0 is the month's last day, null is unset. */
export function dayOfMonthLabel(day: number | null): string {
  if (day == null) return "Not set";
  if (day === 0) return "Last day";
  const rem = day % 100;
  if (rem >= 11 && rem <= 13) return `${day}th`;
  return `${day}${({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[day % 10] ?? "th"}`;
}

const DAYS = Array.from({ length: 31 }, (_, i) => i + 1);

/**
 * A day of the month picked from a calendar-style grid (1-31, then "Last
 * day"), opened from a compact button: one tap, nothing to type, no
 * 32-row native list. Esc or a click outside closes it.
 */
export function DayOfMonthPicker({ id, value, onChange, disabled, label }: { id?: string; value: number | null; onChange: (day: number | null) => void; disabled?: boolean; label: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function pick(day: number | null) {
    setOpen(false);
    if (day !== value) onChange(day);
  }

  const cell = (day: number | null, text: string, className?: string) => (
    <button
      key={text}
      type="button"
      onClick={() => pick(day)}
      aria-pressed={value === day}
      className={cn(
        "h-8 rounded-control text-[13.5px] tabular",
        value === day ? "ui-btn-primary bg-brand text-on-brand font-semibold" : "text-text hover:bg-sunken",
        className,
      )}
    >
      {text}
    </button>
  );

  return (
    <div ref={ref} className="relative">
      <button
        id={id}
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`${label}: ${dayOfMonthLabel(value)}`}
        className={cn(
          "h-8 min-w-[96px] inline-flex items-center justify-between gap-2 rounded-control border border-border-strong bg-surface px-2.5 text-[14px] disabled:opacity-50",
          value == null ? "text-text-3" : "text-text",
        )}
      >
        {dayOfMonthLabel(value)}
        <ChevronDown size={14} strokeWidth={2} className="text-text-3" aria-hidden="true" />
      </button>
      {open && (
        <div role="dialog" aria-label={label} className="absolute right-0 top-full mt-2 z-30 w-[264px] p-3 rounded-card border border-border bg-raised shadow-overlay flex flex-col gap-1">
          <div className="grid grid-cols-7 gap-1">
            {DAYS.map((d) => cell(d, String(d)))}
            {cell(0, "Last day", "col-span-4")}
          </div>
          {value != null && (
            <button type="button" onClick={() => pick(null)} className="self-center mt-1 text-[13px] font-semibold text-text-2 hover:text-text">
              Clear
            </button>
          )}
        </div>
      )}
    </div>
  );
}
