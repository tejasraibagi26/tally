"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";

export interface SearchableSelectOption {
  value: string;
  label: string;
  colorSlot?: number; // renders a category-style color dot next to the label
  indent?: boolean; // renders nested under the preceding non-indented option (e.g. a subcategory under its parent)
}

export interface SearchableSelectProps {
  options: SearchableSelectOption[];
  /** Controlled usage: pass both `value` and `onChange`. */
  value?: string;
  onChange?: (value: string) => void;
  /** Uncontrolled usage (e.g. inside a plain `<form method="get">`): pass `defaultValue` and `name` — a hidden input carries the value at submit time. */
  defaultValue?: string;
  name?: string;
  placeholder?: string; // search box placeholder
  buttonPlaceholder?: string; // shown on the closed control when nothing is selected
  className?: string;
}

/**
 * A searchable dropdown for lists too long to scan as a plain <select> (the
 * ~100-category PFC taxonomy, a growing account list). Supports both
 * controlled (value/onChange) and uncontrolled (defaultValue/name, for a
 * native GET <form>) usage from the same component.
 */
export function SearchableSelect({
  options,
  value,
  onChange,
  defaultValue,
  name,
  placeholder = "Search…",
  buttonPlaceholder = "Select…",
  className,
}: SearchableSelectProps) {
  const isControlled = value !== undefined;
  const [internalValue, setInternalValue] = useState(defaultValue ?? "");
  const currentValue = isControlled ? value! : internalValue;

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = options.find((o) => o.value === currentValue);
  const filtered = query.trim()
    ? options.filter((o) => o.label.toLowerCase().includes(query.trim().toLowerCase()))
    : options;

  useEffect(() => {
    if (!open) return;

    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        setQuery("");
      }
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    inputRef.current?.focus();
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  function select(v: string) {
    if (!isControlled) setInternalValue(v);
    onChange?.(v);
    setOpen(false);
    setQuery("");
  }

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      {name && <input type="hidden" name={name} value={currentValue} />}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full h-9 rounded-control bg-surface-2 border border-border-strong px-2.5 text-sm text-text flex items-center justify-between gap-2"
      >
        <span className="flex items-center gap-1.5 min-w-0 truncate">
          {selected?.colorSlot != null && (
            <span className="w-1.5 h-1.5 rounded-full flex-none" style={{ background: `var(--series-${selected.colorSlot})` }} />
          )}
          <span className={cn("truncate", !selected && "text-text-3")}>{selected?.label ?? buttonPlaceholder}</span>
        </span>
        <span className="text-text-3 text-xs flex-none" aria-hidden>
          ⌄
        </span>
      </button>

      {open && (
        <div className="absolute z-20 mt-1 w-max min-w-full max-w-[340px] rounded-control bg-surface border border-border-strong shadow-overlay overflow-hidden">
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={placeholder}
            className="w-full h-9 px-2.5 text-sm text-text bg-surface-2 border-b border-border focus:outline-none"
          />
          <div className="max-h-60 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <div className="px-2.5 py-2 text-sm text-text-3">No matches</div>
            ) : (
              filtered.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => select(o.value)}
                  className={cn(
                    "w-full flex items-start gap-1.5 px-2.5 py-1.5 text-sm text-left hover:bg-surface-2",
                    o.indent && !query.trim() && "pl-6",
                    o.value === currentValue && "bg-brand-subtle text-brand",
                  )}
                >
                  {o.colorSlot != null && <span className="w-1.5 h-1.5 rounded-full flex-none mt-1.5" style={{ background: `var(--series-${o.colorSlot})` }} />}
                  <span className="whitespace-normal break-words">{o.label}</span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
