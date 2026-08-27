"use client";

import { useEffect, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { applyPrivacy, getStoredPrivacy } from "@/lib/privacy";
import { cn } from "@/lib/cn";

export function PrivacyToggle() {
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

  return (
    <button
      onClick={toggle}
      role="switch"
      aria-checked={hidden}
      aria-label="Hide sensitive amounts"
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
