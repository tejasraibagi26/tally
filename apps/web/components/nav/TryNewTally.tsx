"use client";

import { useUiSwitch } from "@/components/new/UiSwitch";

/** The classic sidebar's way into the new Tally: opts this account in and opens it. */
export function TryNewTally() {
  const { set, busy } = useUiSwitch();
  return (
    <button
      type="button"
      disabled={busy}
      onClick={() => set(true)}
      className="mx-1 flex items-center justify-between gap-3 rounded-card bg-[#11110f] px-3.5 py-2.5 text-left text-[#f2f1ea] hover:text-white disabled:opacity-70"
    >
      <span className="flex flex-col min-w-0">
        <span className="text-[15px] font-bold leading-tight">{busy ? "Switching…" : "Switch to the new Tally"}</span>
        <span className="text-[12.5px] leading-tight text-[#a19f95]">You can switch back anytime</span>
      </span>
      <span aria-hidden="true" className="text-[#c9f26b] text-lg">
        →
      </span>
    </button>
  );
}
