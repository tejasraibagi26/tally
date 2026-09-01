"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, SplitSquareVertical } from "lucide-react";

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
          ? "inline-flex items-center gap-1 self-start h-[22px] px-2 rounded-full text-[11.5px] font-medium whitespace-nowrap bg-positive-subtle text-positive hover:brightness-95 disabled:opacity-40"
          : "inline-flex items-center gap-1 self-start h-[22px] px-2 rounded-full text-[11.5px] font-medium whitespace-nowrap bg-brand-subtle text-brand border border-dashed border-brand-border hover:bg-brand-border/40 disabled:opacity-40"
      }
    >
      {saving ? (
        "…"
      ) : amortizeMonthly ? (
        <>
          <Check size={11} strokeWidth={2.5} />
          Spread across months
        </>
      ) : (
        <>
          <SplitSquareVertical size={11} strokeWidth={2} />
          Spread across months?
        </>
      )}
    </button>
  );
}
