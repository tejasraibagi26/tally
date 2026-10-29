"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { formatCents } from "@tally/core/money";
import type { ForecastAssumptions as Assumptions } from "@/lib/forecast";
import { Button } from "@/components/ui/Button";

function Row({ title, note }: { title: string; note: string }) {
  return (
    <div className="flex flex-col gap-0.5 border-b border-border py-2.5 last:border-b-0">
      <span className="text-[14px] font-semibold text-text">{title}</span>
      <span className="text-[13px] leading-snug text-text-3">{note}</span>
    </div>
  );
}

const SAVE_FAILED = "Couldn't save that. Check your connection and try again.";

/**
 * What the curve assumed, and the one thing the user can change about it.
 *
 * This is not an appendix: a forecast you can't audit is a forecast you
 * can't trust, so every modelled choice is listed in plain words and the
 * single estimate — day-to-day spending — is editable in place.
 */
export function ForecastAssumptions({ assumptions: a, cushion }: { assumptions: Assumptions; cushion: number }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(a.dailySpendCents ? (a.dailySpendCents / 100).toFixed(2) : "");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  async function save(cents: number | null) {
    setError(null);
    const res = await fetch("/api/forecast/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dailySpendCents: cents }),
    }).catch(() => null);
    if (!res?.ok) return setError(SAVE_FAILED);
    setEditing(false);
    start(() => router.refresh());
  }

  const spendNote =
    a.source === "override"
      ? "Your figure. Clear it to go back to Tally's."
      : a.source === "none"
        ? `Needs about 30 days of spending to estimate; Tally has ${a.historyDays}.`
        : `The middle of the last ${a.historyDays} days, counted separately for each day of the week.`;

  return (
    <div className="flex flex-col">
      {editing ? (
        <div className="flex flex-col gap-2 border-b border-border py-2.5">
          <label htmlFor="daily-spend" className="text-[14px] font-semibold text-text">
            Spend about this much a day
          </label>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 rounded-control border border-border-strong bg-surface px-2.5 py-1.5 focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-info">
              <span className="text-[14px] text-text-3">$</span>
              <input
                id="daily-spend"
                type="text"
                inputMode="decimal"
                autoFocus
                value={value}
                onChange={(e) => setValue(e.target.value)}
                className="w-20 bg-transparent text-[14px] tabular text-text outline-none"
                placeholder="62.00"
              />
            </div>
            <Button
              size="sm"
              loading={pending}
              onClick={() => {
                const n = Number(value.replace(/[^0-9.]/g, ""));
                if (!Number.isFinite(n) || n < 0) return setError("Enter an amount like 62.00.");
                void save(Math.round(n * 100));
              }}
            >
              Save
            </Button>
            <Button size="sm" variant="ghost" onClick={() => { setEditing(false); setError(null); }}>
              Cancel
            </Button>
          </div>
          {a.source === "override" && (
            <button type="button" className="self-start text-[13px] text-brand underline-offset-2 hover:underline" onClick={() => void save(null)}>
              Use Tally&apos;s estimate instead
            </button>
          )}
          {error && <p className="m-0 text-[13px] text-negative">{error}</p>}
        </div>
      ) : (
        <div className="flex items-start justify-between gap-3 border-b border-border py-2.5">
          <span className="flex flex-col gap-0.5">
            <span className="money text-[14px] font-semibold text-text tabular">
              {a.source === "none" ? "No spending estimate yet" : `Spending about ${formatCents(a.dailySpendCents)} a day`}
            </span>
            <span className="text-[13px] leading-snug text-text-3">{spendNote}</span>
          </span>
          <Button size="sm" variant="secondary" onClick={() => setEditing(true)}>
            Edit
          </Button>
        </div>
      )}

      <Row
        title={cushion > 0 ? `Buffer ${formatCents(cushion)}` : "No buffer set"}
        note={cushion > 0 ? "From Safe to spend, so the two screens agree." : "Set one in Settings and Tally will warn you before you reach it."}
      />
      <Row
        title={`${a.paycheques} paycheque${a.paycheques === 1 ? "" : "s"} ahead`}
        note={a.paycheques ? "From your pay schedule, moved back off weekends." : "Set a pay schedule and Tally can project the whole picture."}
      />
      <Row
        title={`${a.bills} bill${a.bills === 1 ? "" : "s"} from Subscriptions`}
        note={a.lumpy.length ? `${a.lumpy.join(", ")} counted whole on the day it lands, not spread.` : "A missing bill is added in Subscriptions."}
      />
      {a.cardsExcluded.map((label) => (
        <Row key={label} title={`${label} — not counted`} note="No statement and no due day set." />
      ))}
      {a.stale.map((s) => (
        <Row key={s.id} title={`${s.name} is out of date`} note="Its balance hasn't synced today, so the whole curve starts from an old number." />
      ))}
    </div>
  );
}
