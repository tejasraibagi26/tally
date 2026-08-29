"use client";

import { useState } from "react";

export function RecapsToggle({ initialEnabled }: { initialEnabled: boolean }) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [loading, setLoading] = useState(false);

  async function toggle() {
    const next = !enabled;
    setEnabled(next);
    setLoading(true);
    try {
      const res = await fetch("/api/settings/recaps", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: next }),
      });
      if (!res.ok) setEnabled(!next);
    } catch {
      setEnabled(!next);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex flex-col gap-0.5">
        <span className="text-[15px] text-text">Monthly recap email</span>
        <span className="text-[13.5px] text-text-2">A summary of income, spend, budgets, and net worth on the 1st of each month.</span>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        disabled={loading}
        onClick={toggle}
        className={`relative h-6 w-11 flex-none rounded-full transition-colors ${enabled ? "bg-brand" : "bg-border-strong"} disabled:opacity-60`}
      >
        <span className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${enabled ? "translate-x-5" : "translate-x-0"}`} />
      </button>
    </div>
  );
}
