"use client";

import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Spinner } from "@/components/ui/Button";

export type SaveState = "idle" | "saving" | "saved" | "error";

/**
 * Autosave feedback for a panel or planner that saves as you edit
 * (TransactionDetailPanel, FIRE). Saving: a small spinner. Saved: a green
 * dot that fades after 2s. Error: a red chip with Retry. Idle shows nothing.
 */
export function SaveStatus({ state, retry }: { state: SaveState; retry?: (() => void) | null }) {
  const [showSaved, setShowSaved] = useState(false);
  useEffect(() => {
    if (state !== "saved") return;
    setShowSaved(true);
    const t = setTimeout(() => setShowSaved(false), 2000);
    return () => clearTimeout(t);
  }, [state]);

  if (state === "error") {
    return (
      <span role="alert" className="inline-flex items-center gap-1.5 rounded-full bg-negative-subtle px-2.5 py-0.5 text-[12.5px] text-negative">
        <AlertTriangle size={12} strokeWidth={2} className="flex-none" />
        Couldn&apos;t save
        {retry && (
          <>
            {" · "}
            <button type="button" onClick={retry} className="font-semibold underline">
              Retry
            </button>
          </>
        )}
      </span>
    );
  }
  if (state === "saving" || (state === "saved" && showSaved)) {
    return (
      <span aria-live="polite" className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-2 px-2.5 py-0.5 text-[12.5px] text-text-3">
        {state === "saving" ? <Spinner /> : <span className="w-1.5 h-1.5 rounded-full bg-positive" />}
        {state === "saving" ? "Saving" : "Saved"}
      </span>
    );
  }
  return null;
}
