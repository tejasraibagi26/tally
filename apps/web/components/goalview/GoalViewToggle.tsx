"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Switch } from "@/components/ui/Switch";
import { showToast } from "@/lib/toast";

/**
 * Turns the goal view on and off (users.goal_view_at via
 * PATCH /api/settings/goal-view).
 *
 * Reloads rather than just refreshing, because the opt-in is read on the
 * server in three places: Overview, Budgets, and the root layout's
 * data-skin attribute, which a client-side refresh would leave stale.
 */
export function GoalViewToggle({ enabled: initial }: { enabled: boolean }) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(initial);
  const [busy, setBusy] = useState(false);

  async function set(next: boolean) {
    setBusy(true);
    setEnabled(next);
    try {
      const res = await fetch("/api/settings/goal-view", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: next }),
      });
      if (!res.ok) throw new Error("Failed");
      router.refresh();
      window.location.reload();
    } catch {
      setEnabled(!next);
      setBusy(false);
      showToast("Couldn't change that. Try again.", "negative");
    }
  }

  return <Switch checked={enabled} onChange={set} disabled={busy} label="Show the goal view on Overview and Budgets" />;
}
