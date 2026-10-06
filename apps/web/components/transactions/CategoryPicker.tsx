"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import type { DetailCategoryOption } from "@/components/transactions/TransactionDetailPanel";

/**
 * A small searchable category list -- opened from a row's category chip,
 * the bulk bar, and the review queue. Arrow keys move, Enter picks, Escape
 * closes. Positioned by its parent (absolute, under the trigger).
 */
export function CategoryPicker({
  categories,
  selectedId,
  onPick,
  onClose,
  className,
}: {
  categories: DetailCategoryOption[];
  selectedId?: string | null;
  onPick: (categoryId: string) => void;
  onClose: () => void;
  className?: string;
}) {
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const options = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return needle ? categories.filter((c) => c.name.toLowerCase().includes(needle)) : categories;
  }, [q, categories]);

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [onClose]);

  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  return (
    <div ref={ref} className={cn("z-30 w-64 rounded-control border border-border bg-raised shadow-overlay p-1.5 flex flex-col gap-1", className)} onClick={(e) => e.stopPropagation()}>
      <input
        autoFocus
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setActive(0);
        }}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((a) => Math.min(options.length - 1, a + 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((a) => Math.max(0, a - 1));
          } else if (e.key === "Enter") {
            e.preventDefault();
            const o = options[active];
            if (o) onPick(o.id);
          } else if (e.key === "Escape") {
            // Closes only the picker, not a side panel it sits in.
            e.stopPropagation();
            onClose();
          }
        }}
        placeholder="Find a category"
        aria-label="Find a category"
        className="h-8 rounded-[6px] bg-surface-2 border border-border px-2 text-[13px] text-text placeholder:text-text-3 focus:outline-none focus:ring-2 focus:ring-info"
      />
      <ul ref={listRef} role="listbox" className="m-0 p-0 list-none max-h-64 overflow-y-auto">
        {options.length === 0 && <li className="px-2 py-2 text-[13px] text-text-3">No matching category</li>}
        {options.map((c, i) => (
          <li key={c.id} data-index={i} role="option" aria-selected={c.id === selectedId}>
            <button
              type="button"
              onMouseEnter={() => setActive(i)}
              onClick={() => onPick(c.id)}
              className={cn("w-full flex items-center gap-2 rounded-[6px] px-2 py-1.5 text-left text-[13px]", i === active ? "bg-raised-hover text-text" : "text-text-2", c.indent && "pl-6")}
            >
              <span className="w-2 h-2 rounded-full flex-none" style={{ background: `var(--series-${c.colorSlot})` }} />
              <span className="truncate flex-1">{c.name}</span>
              {c.id === selectedId && <span className="text-brand text-xs">✓</span>}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
