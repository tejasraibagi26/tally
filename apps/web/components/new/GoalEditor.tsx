"use client";

import { useState } from "react";
import { useMutate } from "@/components/new/useMutate";
import { ConfirmButton } from "@/components/new/ConfirmButton";

/**
 * Set or change the year-end net worth goal, or stop tracking it. Same
 * /api/goals the classic Goals page uses: a new goal starts from today's
 * net worth; changing one keeps where it started.
 */
export function GoalEditor({ current, defaultDeadline }: { current: { targetCents: number; deadline: string } | null; defaultDeadline: string }) {
  const { run, busy } = useMutate();
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState(current ? String(current.targetCents / 100) : "");
  const [deadline, setDeadline] = useState(current?.deadline ?? defaultDeadline);
  const cents = Math.round((Number(target.replace(/[^0-9.]/g, "")) || 0) * 100);

  if (!open) {
    return (
      <button type="button" className={`tn-btn ${current ? "" : "tn-btn-lime"}`} onClick={() => setOpen(true)}>
        {current ? "Change goal" : "Set a goal"}
      </button>
    );
  }

  return (
    <form
      className="tn-card"
      style={{ display: "flex", flexDirection: "column", gap: 14, maxWidth: 560, width: "100%" }}
      onSubmit={async (e) => {
        e.preventDefault();
        if (cents <= 0) return;
        if (await run("PUT", "/api/goals", { targetCents: cents, deadline }, current ? "Goal updated" : "Goal set")) setOpen(false);
      }}
    >
      <span className="tn-disp" style={{ fontSize: 20, fontWeight: 700 }}>
        {current ? "Change your goal" : "What should your net worth be?"}
      </span>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>
        <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span className="tn-muted" style={{ fontSize: 13 }}>
            Net worth of
          </span>
          <input className="tn-input" inputMode="decimal" placeholder="$55,000" value={target} onChange={(e) => setTarget(e.target.value)} style={{ width: 180 }} required autoFocus />
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span className="tn-muted" style={{ fontSize: 13 }}>
            By
          </span>
          <input className="tn-input" type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} required />
        </label>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
        <button type="submit" className="tn-btn tn-btn-lime tn-btn-sm" disabled={busy || cents <= 0}>
          {current ? "Save" : "Set goal"}
        </button>
        <button type="button" className="tn-btn tn-btn-sm" onClick={() => setOpen(false)}>
          Cancel
        </button>
        {current && (
          <span style={{ marginLeft: "auto" }}>
            <ConfirmButton
              label="Stop tracking"
              question="Stop tracking this goal?"
              confirmLabel="Yes, stop"
              disabled={busy}
              onConfirm={async () => {
                if (await run("DELETE", "/api/goals", undefined, "Goal removed")) setOpen(false);
              }}
            />
          </span>
        )}
      </div>
    </form>
  );
}
