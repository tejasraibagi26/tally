"use client";

import { useEffect, useState } from "react";
import { applyDarkV2, getStoredDarkV2 } from "@/lib/theme";

// TEMPORARY -- see DARK_V2_STORAGE_KEY in lib/theme.ts. Per-browser (like
// the theme and hide-amounts toggles), not a server-side setting: it's a
// look-and-feel trial, not an account preference.
export function DarkModePreviewToggle() {
  const [enabled, setEnabled] = useState(false);
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    setEnabled(getStoredDarkV2());
    setIsDark(document.documentElement.getAttribute("data-theme") === "dark");
  }, []);

  function toggle() {
    const next = !enabled;
    setEnabled(next);
    applyDarkV2(next);
  }

  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex flex-col gap-0.5">
        <span className="text-[15px] text-text">Refined dark mode (preview)</span>
        <span className="text-[13.5px] text-text-2">
          Higher-contrast dark palette with clearer card edges. Flip it to compare with the current one.
          {!isDark && " Only visible while the theme is set to dark."}
        </span>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        aria-label="Refined dark mode (preview)"
        title={enabled ? "Use the current dark mode" : "Try the refined dark mode"}
        onClick={toggle}
        className={`relative h-6 w-11 flex-none rounded-full transition-colors ${enabled ? "bg-brand" : "bg-border-strong"}`}
      >
        <span className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${enabled ? "translate-x-5" : "translate-x-0"}`} />
      </button>
    </div>
  );
}
