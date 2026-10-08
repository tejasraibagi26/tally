"use client";

import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { cn } from "@/lib/cn";

const EXIT_MS = 120;

// DESIGN.md §8 "Modal": 480/640px, radius 16, centered, over the --scrim
// token. Same ESC/click-outside/focus-trap treatment as SidePanel, just
// centered instead of sliding from the edge. Enters with a 180ms fade + 2%
// scale and fades out over 120ms (§11), so it stays mounted briefly after
// `open` goes false.
export function Modal({
  open,
  onClose,
  children,
  width = 480,
  dismissible = true,
  initialFocusRef,
  labelledBy,
  busy = false,
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  width?: 480 | 640;
  /** False while work is running that mustn't be abandoned: Esc and scrim clicks do nothing. */
  dismissible?: boolean;
  /** Focused on open instead of the dialog itself (e.g. Cancel on a destructive confirm). */
  initialFocusRef?: RefObject<HTMLElement | null>;
  labelledBy?: string;
  busy?: boolean;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(open);
  const [closing, setClosing] = useState(false);
  // Held in refs so a caller passing a fresh onClose each render doesn't
  // re-run the open effect (which would steal focus back to the dialog).
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const dismissibleRef = useRef(dismissible);
  dismissibleRef.current = dismissible;

  useEffect(() => {
    if (open) {
      setMounted(true);
      setClosing(false);
      return;
    }
    if (!mounted) return;
    setClosing(true);
    const t = setTimeout(() => {
      setMounted(false);
      setClosing(false);
    }, EXIT_MS);
    return () => clearTimeout(t);
  }, [open, mounted]);

  useEffect(() => {
    if (!open) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && dismissibleRef.current) onCloseRef.current();
      if (e.key === "Tab" && dialogRef.current) {
        const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not(:disabled), [href], input:not(:disabled), select, textarea, [tabindex]:not([tabindex="-1"])',
        );
        if (focusable.length === 0) {
          e.preventDefault();
          return;
        }
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
    (initialFocusRef?.current ?? dialogRef.current)?.focus();

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      previouslyFocused?.focus();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!mounted) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className={cn(
          "absolute inset-0 backdrop-blur-[2px] motion-reduce:animate-none",
          closing ? "animate-[dialog-out_120ms_ease-in_forwards]" : "animate-[fade-in_180ms_ease-out]",
        )}
        style={{ backgroundColor: "var(--scrim)" }}
        onClick={() => dismissible && onClose()}
        aria-hidden="true"
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        aria-busy={busy || undefined}
        tabIndex={-1}
        className={cn(
          "relative w-full bg-raised border border-border rounded-[16px] shadow-overlay outline-none max-h-[90vh] overflow-y-auto",
          "motion-reduce:animate-none",
          closing ? "animate-[dialog-out_120ms_ease-in_forwards]" : "animate-[dialog-in_180ms_ease-out]",
        )}
        style={{ maxWidth: width }}
      >
        {children}
      </div>
    </div>
  );
}
