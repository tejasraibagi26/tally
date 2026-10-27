"use client";

import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { applyUi, isPopOn } from "@/lib/uiFlag";
import { cn } from "@/lib/cn";

/**
 * The SideNav footer's "New look" row: Tally Pop (the default) or the
 * classic look (lib/uiFlag.ts), for everyone. Starts on, matching the
 * default, and reads this browser's choice after mount.
 */
export function UiToggle() {
  const [pop, setPop] = useState(true);

  useEffect(() => {
    setPop(isPopOn());
  }, []);

  function toggle() {
    const next = !pop;
    setPop(next);
    applyUi(next);
    // Saved to the account too, so emails and the mobile app follow the
    // switch. The look has already changed; a failed save only leaves them.
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
