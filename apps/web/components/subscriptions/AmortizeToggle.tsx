"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function AmortizeToggle({ streamId, amortizeMonthly }: { streamId: string; amortizeMonthly: boolean }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  async function toggle() {
    setSaving(true);
    try {
      const res = await fetch(`/api/recurring-streams/${streamId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amortizeMonthly: !amortizeMonthly }),
      });
      if (!res.ok) throw new Error("Failed to update");
      router.refresh();
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={saving}
      title={amortizeMonthly ? "Charged once a year, but spread 1/12 across every month's budget. Click to stop spreading it." : "Click to spread this annual charge as 1/12 across every month's budget instead of hitting one month all at once."}
      className={
        amortizeMonthly
          ? "text-[12px] text-positive whitespace-nowrap disabled:opacity-40"
          : "text-[12px] text-brand whitespace-nowrap disabled:opacity-40"
      }
    >
      {saving ? "…" : amortizeMonthly ? "Spread across months ✓" : "Spread across months?"}
    </button>
  );
}
