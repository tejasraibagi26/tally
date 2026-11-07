"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { showToast } from "@/lib/toast";

/** Turns the new Tally on or off for this account, then goes to the matching home. */
export function useUiSwitch() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function set(enabled: boolean) {
    setBusy(true);
    try {
      const res = await fetch("/api/settings/new-ui", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ enabled }) });
      if (!res.ok) {
        showToast("Couldn't switch. Try again.", "negative");
        return;
      }
      router.push(enabled ? "/new" : "/overview");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }
  return { set, busy };
}

/** "Classic view" in the new header: turns the new Tally off and goes back. */
export function ClassicButton() {
  const { set, busy } = useUiSwitch();
  return (
    <button type="button" className="tn-classic" style={{ background: "none", border: 0, padding: 0, font: "inherit", cursor: "pointer" }} disabled={busy} onClick={() => set(false)}>
      {busy ? "Switching…" : "Classic view"}
    </button>
  );
}

/** Shown on /new to someone who hasn't opted in yet. */
export function MakeDefaultBanner() {
  const { set, busy } = useUiSwitch();
  return (
    <div className="tn-banner" style={{ background: "var(--tn-surface)", boxShadow: "inset 0 0 0 1px var(--tn-line-2)" }}>
      <i className="tn-dot" style={{ background: "var(--tn-lime)" }} />
      <span style={{ flex: "1 1 320px" }}>
        You&apos;re previewing the new Tally. <span className="tn-muted">Make it your default and Tally opens here every time. You can switch back in Settings.</span>
      </span>
      <button type="button" className="tn-btn tn-btn-lime tn-btn-sm" disabled={busy} onClick={() => set(true)}>
        {busy ? "Switching…" : "Make it my default"}
      </button>
    </div>
  );
}
