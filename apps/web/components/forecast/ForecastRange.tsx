"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { FORECAST_RANGES, type ForecastRange as Range } from "@tally/core/forecast";
import { cn } from "@/lib/cn";

/**
 * 30 / 60 / 90, in one row above the chart (DESIGN.md §7.4). The choice is
 * remembered per user, so the page opens where you left it.
 */
export function ForecastRange({ value }: { value: Range }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  function pick(days: Range) {
    if (days === value) return;
    fetch("/api/forecast/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ days }),
    }).catch(() => {});
    start(() => router.push(`/forecast?days=${days}`, { scroll: false }));
  }

  return (
    <div className="flex items-center gap-1.5" role="group" aria-label="How far ahead">
      {FORECAST_RANGES.map((days) => (
        <button
          key={days}
          type="button"
          onClick={() => pick(days)}
          aria-pressed={days === value}
          disabled={pending}
          className={cn(
            "ui-btn rounded-full border px-3 py-1 text-[13px] font-semibold tabular transition-colors",
            days === value
              ? "ui-btn-primary border-transparent bg-brand text-on-brand"
              : "ui-btn-secondary border-border-strong bg-surface text-text hover:bg-surface-2",
          )}
        >
          {days}
          <span className="sr-only"> days</span>
        </button>
      ))}
    </div>
  );
}
