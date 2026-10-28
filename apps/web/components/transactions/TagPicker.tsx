"use client";

import { useEffect, useRef, useState } from "react";
import { Tag } from "lucide-react";
import { normalizeTag } from "@tally/core/tagView";
import { cn } from "@/lib/cn";

/**
 * The bulk bar's "Tag" popover: type a new tag or pick one already in use,
 * Enter applies it. Esc or a click outside closes it.
 */
export function TagPicker({ known, onPick, onClose, className }: { known: string[]; onPick: (tag: string) => void; onClose: () => void; className?: string }) {
  const [text, setText] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [onClose]);

  const typed = normalizeTag(text);
  const matches = known.filter((t) => t.toLowerCase().includes(typed.toLowerCase())).slice(0, 6);
  const isNew = typed !== "" && !known.some((t) => t.toLowerCase() === typed.toLowerCase());

  return (
    <div ref={ref} className={cn("z-30 w-[260px] p-2 rounded-card border border-border bg-raised shadow-overlay flex flex-col gap-1", className)}>
      <input
        autoFocus
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") onClose();
          if (e.key === "Enter" && typed) onPick(matches.find((t) => t.toLowerCase() === typed.toLowerCase()) ?? typed);
        }}
        placeholder="Tag, e.g. Japan 2026"
        aria-label="Tag name"
        maxLength={40}
        className="h-9 rounded-control border border-border-strong bg-surface px-2.5 text-[14px] text-text outline-none focus-visible:ring-2 focus-visible:ring-info"
      />
      {isNew && (
        <button type="button" onClick={() => onPick(typed)} className="flex items-center gap-2 px-2 py-1.5 rounded-control text-left text-[13.5px] text-text hover:bg-sunken">
          <Tag size={13} strokeWidth={2.2} className="text-brand" aria-hidden="true" />
          Add “{typed}”
        </button>
      )}
      {matches.map((t) => (
        <button key={t} type="button" onClick={() => onPick(t)} className="flex items-center gap-2 px-2 py-1.5 rounded-control text-left text-[13.5px] text-text-2 hover:bg-sunken hover:text-text">
          <Tag size={13} strokeWidth={2} aria-hidden="true" />
          {t}
        </button>
      ))}
    </div>
  );
}
