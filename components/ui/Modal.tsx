"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { cn } from "@/lib/cn";

// DESIGN.md §8 "Modal": 480/640px, radius 16, centered, --canvas scrim at
// 60%. Same ESC/click-outside/focus-trap treatment as SidePanel, just
// centered instead of sliding from the edge.
export function Modal({
  open,
  onClose,
  children,
  width = 480,
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  width?: 480 | 640;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "Tab" && dialogRef.current) {
        const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        );
        if (focusable.length === 0) return;
        const first = focusable[0]!;
        const last = focusable[focusable.length - 1]!;
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }

    const previouslyFocused = document.activeElement as HTMLElement | null;
    document.addEventListener("keydown", handleKeyDown);
    dialogRef.current?.focus();

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      previouslyFocused?.focus();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 motion-reduce:transition-none transition-opacity"
        style={{ backgroundColor: "color-mix(in srgb, var(--canvas) 60%, transparent)" }}
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        className={cn(
          "relative w-full bg-surface border border-border rounded-[16px] shadow-overlay outline-none max-h-[90vh] overflow-y-auto",
          "animate-[fade-in-up_220ms_cubic-bezier(.32,.72,0,1)] motion-reduce:animate-none",
        )}
        style={{ maxWidth: width }}
      >
        {children}
      </div>
    </div>
  );
}
