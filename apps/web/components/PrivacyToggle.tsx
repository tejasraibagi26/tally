"use client";

import { useEffect, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { applyPrivacy, getStoredPrivacy } from "@/lib/privacy";
import { cn } from "@/lib/cn";

/** `variant="row"` is the SideNav footer form: a full-width nav-style row with a small switch on the right. */
export function PrivacyToggle({ variant = "switch" }: { variant?: "switch" | "row" }) {
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const stored = getStoredPrivacy() ?? false;
    setHidden(stored);
    document.documentElement.setAttribute("data-hide-amounts", String(stored));
  }, []);

  function toggle() {
    const next = !hidden;
    setHidden(next);
    applyPrivacy(next);
  }

  if (variant === "row") {
    return (
      <button onClick={toggle} role="switch" aria-checked={hidden} aria-label="Hide sensitive amounts" className="w-full flex items-center justify-between gap-2.5 px-2.5 py-2 rounded-control text-[15px] text-text-2 hover:bg-sunken hover:text-text transition-colors">
        <span className="flex items-center gap-2.5">
          {hidden ? <EyeOff size={17} strokeWidth={1.75} /> : <Eye size={17} strokeWidth={1.75} />}
          Hide amounts
        </span>
        <span
          aria-hidden
          className={cn(
            "relative w-[30px] h-[18px] flex-none rounded-full border transition-colors duration-200",
            hidden ? "bg-brand border-brand" : "bg-sunken border-border-strong",
          )}
        >
          <span
            className={cn(
              "absolute top-[2px] left-[2px] w-3 h-3 rounded-full transition-transform duration-200",
              hidden ? "translate-x-3 bg-on-brand" : "bg-text-3",
            )}
          />
        </span>
      </button>
    );
  }

  return (
    <button
      onClick={toggle}
      role="switch"
      aria-checked={hidden}
      aria-label="Hide sensitive amounts"
      title={hidden ? "Show amounts" : "Hide amounts"}
      className={cn(
        "relative inline-flex items-center flex-none w-[52px] h-7 rounded-full border border-border-strong transition-colors duration-300",
        hidden ? "bg-sunken" : "bg-surface-2",
      )}
    >
      <span
        className={cn(
          "absolute top-0.5 left-0.5 w-6 h-6 rounded-full bg-surface shadow-raised flex items-center justify-center transition-transform duration-300 ease-out",
          hidden && "translate-x-[24px]",
        )}
      >
        {hidden ? <EyeOff size={13} strokeWidth={2} className="text-text-2" /> : <Eye size={13} strokeWidth={2} className="text-text-2" />}
      </span>
    </button>
  );
}
