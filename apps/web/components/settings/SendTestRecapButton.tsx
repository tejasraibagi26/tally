"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";

type Status = { kind: "idle" } | { kind: "loading" } | { kind: "sent"; monthLabel: string } | { kind: "skipped" } | { kind: "error"; message: string };

export function SendTestRecapButton() {
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  async function send() {
    setStatus({ kind: "loading" });
    try {
      const res = await fetch("/api/settings/recaps/test", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      const data = await res.json();
      if (!res.ok) {
        setStatus({ kind: "error", message: data.error ?? "Something went wrong" });
        return;
      }
      if (data.result.status === "sent") {
        setStatus({ kind: "sent", monthLabel: data.result.monthLabel });
      } else {
        setStatus({ kind: "skipped" });
      }
    } catch {
      setStatus({ kind: "error", message: "Something went wrong" });
    }
  }

  return (
    <div className="flex flex-col gap-3 pt-4 mt-1 border-t border-border">
      <div className="flex items-center justify-between gap-4">
        <span className="text-[13.5px] text-text-2">Preview this month&apos;s recap, sent to your own inbox right now.</span>
        <Button type="button" variant="secondary" size="sm" onClick={send} disabled={status.kind === "loading"}>
          {status.kind === "loading" ? "Sending…" : "Send test recap"}
        </Button>
      </div>
      {status.kind === "sent" && <span className="text-sm text-positive">Sent — check your inbox for the {status.monthLabel} recap.</span>}
      {/* The test route skips the already-sent/no-activity checks, so "no accounts" is the only skip reason it can actually return. */}
      {status.kind === "skipped" && <span className="text-sm text-text-2">Nothing sent — no accounts connected yet.</span>}
      {status.kind === "error" && <span className="text-sm text-negative">{status.message}</span>}
    </div>
  );
}
