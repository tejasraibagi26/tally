"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, SplitSquareVertical } from "lucide-react";

const TERM_OPTIONS = [3, 6, 9, 12] as const;

// "Spread across months" for a prepaid plan: once on, the charge is split
// evenly over its billing term (3, 6, 9 or 12 months, starting with the
// month it was paid) -- see lib/recurringBillGeneration.ts. The term picker
// only shows while it's on; turning it on starts at the stream's current
// term (12 unless changed).
export function AmortizeToggle({ streamId, amortizeMonthly, amortizeMonths }: { streamId: string; amortizeMonthly: boolean; amortizeMonths: number }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  async function patch(body: { amortizeMonthly?: boolean; amortizeMonths?: number }) {
    setSaving(true);
    try {
      const res = await fetch(`/api/recurring-streams/${streamId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
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
    <span className="inline-flex items-center gap-1.5 self-start">
      <button
        type="button"
        onClick={() => patch({ amortizeMonthly: !amortizeMonthly })}
        disabled={saving}
        title={
          amortizeMonthly
            ? `Charged once every ${amortizeMonths} months, spread evenly across each month of that term. Click to stop spreading it.`
            : "Click to spread this charge evenly across the months it covers instead of hitting one month all at once."
        }
        className={
          amortizeMonthly
            ? "inline-flex items-center gap-1 h-[22px] px-2 rounded-full text-[11.5px] font-medium whitespace-nowrap bg-positive-subtle text-positive hover:brightness-95 disabled:opacity-40"
            : "inline-flex items-center gap-1 h-[22px] px-2 rounded-full text-[11.5px] font-medium whitespace-nowrap bg-brand-subtle text-brand border border-dashed border-brand-border hover:bg-brand-border/40 disabled:opacity-40"
        }
      >
        {saving ? (
          "…"
        ) : amortizeMonthly ? (
          <>
            <Check size={11} strokeWidth={2.5} />
            Spread across
          </>
        ) : (
          <>
            <SplitSquareVertical size={11} strokeWidth={2} />
            Spread across months?
          </>
        )}
      </button>
      {amortizeMonthly && (
        <select
          aria-label="Months this charge covers"
          value={amortizeMonths}
          disabled={saving}
          onChange={(e) => patch({ amortizeMonths: Number(e.target.value) })}
          className="h-[22px] rounded-full bg-positive-subtle text-positive text-[11.5px] font-medium px-1.5 border-none disabled:opacity-40"
        >
          {TERM_OPTIONS.map((m) => (
            <option key={m} value={m}>
              {m} months
            </option>
          ))}
        </select>
      )}
    </span>
  );
}
