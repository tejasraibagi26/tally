"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";

export interface MultiSelectOption {
  value: string;
  label: string;
}

export interface MultiSelectProps {
  options: MultiSelectOption[];
  values: string[];
  onChange: (values: string[]) => void;
  placeholder?: string; // search box placeholder
  buttonPlaceholder?: string; // shown on the closed control when nothing is selected
  className?: string;
}

/**
 * SearchableSelect's multi-select sibling -- same dropdown-with-search
 * shell, but picking an option toggles it into a set instead of closing the
 * dropdown, matching mobile's MultiPickerSheet (account filtering is the
 * one place on web that needs several accounts at once; every other
 * SearchableSelect usage is genuinely single-value, so this stays a
 * separate component rather than overloading that one's prop contract).
 */
export function MultiSelect({ options, values, onChange, placeholder = "Search…", buttonPlaceholder = "Select…", className }: MultiSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedSet = new Set(values);
  const filtered = query.trim() ? options.filter((o) => o.label.toLowerCase().includes(query.trim().toLowerCase())) : options;

  const summary =
    values.length === 0
      ? buttonPlaceholder
      : values.length === 1
        ? (options.find((o) => o.value === values[0])?.label ?? "1 selected")
        : `${values.length} selected`;

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

  function toggle(v: string) {
    onChange(selectedSet.has(v) ? values.filter((x) => x !== v) : [...values, v]);
  }

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full h-9 rounded-control bg-surface-2 border border-border-strong px-2.5 text-sm text-text flex items-center justify-between gap-2"
      >
        <span className={cn("truncate", values.length === 0 && "text-text-3")}>{summary}</span>
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
              filtered.map((o) => {
                const checked = selectedSet.has(o.value);
                return (
                  <button
                    key={o.value}
                    type="button"
                    onClick={() => toggle(o.value)}
                    className={cn("w-full flex items-center gap-2 px-2.5 py-1.5 text-sm text-left hover:bg-surface-2", checked && "bg-brand-subtle text-brand")}
                  >
                    <span
                      className={cn(
                        "w-3.5 h-3.5 rounded-[4px] border flex-none flex items-center justify-center",
                        checked ? "bg-brand border-brand" : "border-border-strong",
                      )}
                      aria-hidden
                    >
                      {checked && (
                        <svg width="9" height="9" viewBox="0 0 12 12" fill="none">
                          <path d="M2 6.5L4.8 9.5L10 3" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </span>
                    <span className="whitespace-normal break-words">{o.label}</span>
                  </button>
                );
              })
            )}
          </div>
          {values.length > 0 && (
            <button
              type="button"
              onClick={() => onChange([])}
              className="w-full px-2.5 py-1.5 text-xs text-text-2 text-left border-t border-border hover:text-text"
            >
              Clear selection
            </button>
          )}
        </div>
      )}
    </div>
  );
}
