"use client";

import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { applyUi, hasPopFlag, isPopOn } from "@/lib/uiFlag";
import { cn } from "@/lib/cn";

/**
 * The SideNav footer's "New look" row: flips between the Tally Pop preview
 * and the current UI. Renders nothing unless this browser has the Pop
 * feature flag (lib/uiFlag.ts, set only by visiting /labs/pop). Cookies are
 * read after mount, so the server and first client render agree.
 */
export function UiToggle() {
  const [flagged, setFlagged] = useState(false);
  const [pop, setPop] = useState(false);

  useEffect(() => {
    setFlagged(hasPopFlag());
    setPop(isPopOn());
  }, []);

  if (!flagged) return null;

  function toggle() {
    const next = !pop;
    setPop(next);
    applyUi(next);
    // Saved to the account too, so emails follow the switch. The look has
    // already changed; a failed save only leaves emails as they were.
    fetch("/api/settings/ui-look", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ look: next ? "pop" : "classic" }),
    }).catch(() => {});
  }

  return (
    <button onClick={toggle} role="switch" aria-checked={pop} aria-label="New look" className="w-full flex items-center justify-between gap-2.5 px-2.5 py-2 rounded-control text-[15px] text-text-2 hover:bg-sunken hover:text-text transition-colors">
      <span className="flex items-center gap-2.5">
        <Sparkles size={17} strokeWidth={1.75} />
        New look
      </span>
      <span
        aria-hidden
        className={cn(
          "relative w-[30px] h-[18px] flex-none rounded-full border transition-colors duration-200",
          pop ? "bg-brand border-brand" : "bg-sunken border-border-strong",
        )}
      >
        <span
          className={cn(
            "absolute top-[2px] left-[2px] w-3 h-3 rounded-full transition-transform duration-200",
            pop ? "translate-x-3 bg-on-brand" : "bg-text-3",
          )}
        />
      </span>
    </button>
  );
}
