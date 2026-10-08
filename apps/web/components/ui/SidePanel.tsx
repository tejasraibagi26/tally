"use client";

import { useEffect, useRef, type ReactNode } from "react";

// DESIGN.md §8: "420px, slides from the right, overlay shadow, ESC +
// click-outside to close, focus trapped." §11: 220ms cubic-bezier(.32,.72,0,1),
// replaced with an instant state change under prefers-reduced-motion.
export function SidePanel({
  open,
  onClose,
  children,
  dismissible = true,
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  /** False while a save is in flight: Esc and scrim clicks do nothing (same as Modal). */
  dismissible?: boolean;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const dismissibleRef = useRef(dismissible);
  dismissibleRef.current = dismissible;

  useEffect(() => {
    if (!open) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && dismissibleRef.current) onClose();
      if (e.key === "Tab" && panelRef.current) {
        const focusable = panelRef.current.querySelectorAll<HTMLElement>(
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
    panelRef.current?.focus();

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      previouslyFocused?.focus();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div
        className="absolute inset-0 backdrop-blur-[2px] animate-[fade-in_180ms_ease-out] motion-reduce:animate-none"
        style={{ backgroundColor: "var(--scrim)" }}
        onClick={() => dismissible && onClose()}
        aria-hidden="true"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        className="relative w-[420px] max-w-full h-full bg-raised border-l border-border shadow-overlay overflow-y-auto outline-none animate-[slide-in-right_220ms_cubic-bezier(.32,.72,0,1)] motion-reduce:animate-none"
      >
        {children}
      </div>
    </div>
  );
}
