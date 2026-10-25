"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";
import { Eye } from "lucide-react";

/**
 * Persistent strip across the top of the app shell during a demo session.
 * Always visible (not dismissible) for the same reason the "Mock data" chip
 * is: sample numbers should never be mistaken for someone's real finances.
 */
export function DemoBanner() {
  const [leaving, setLeaving] = useState(false);

  return (
    <div className="flex-none flex items-center justify-center gap-x-3 gap-y-1 flex-wrap bg-info-subtle border-b border-border px-4 py-2 text-[13.5px] text-text">
      <span className="inline-flex items-center gap-2">
        <Eye size={15} strokeWidth={1.75} className="flex-none text-info" />
        <span>
          <span className="font-medium">You&apos;re exploring a demo.</span>{" "}
          <span className="text-text-2">Sample data for one fictional household — look around, but nothing saves.</span>
        </span>
      </span>
      <button
        type="button"
        onClick={() => {
          setLeaving(true);
          void signOut({ redirectTo: "/" });
        }}
        disabled={leaving}
        className="underline underline-offset-2 text-text-2 hover:text-text transition-colors disabled:opacity-60"
      >
        {leaving ? "Leaving…" : "Exit demo"}
      </button>
    </div>
  );
}
