"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";

const inputClass =
  "h-9 rounded-control border border-border-strong bg-surface px-3 text-[15px] text-text focus:outline-none focus:ring-2 focus:ring-negative";
const labelClass = "text-xs font-medium uppercase tracking-wide text-text-2";

const CONFIRM_PHRASE = "WIPE";

export function DangerZone({ itemCount }: { itemCount: number }) {
  const router = useRouter();
  const [confirmText, setConfirmText] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const canSubmit = confirmText === CONFIRM_PHRASE && currentPassword.length > 0 && !loading;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/account/wipe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong");
        setLoading(false);
        return;
      }
      setDone(true);
      setConfirmText("");
      setCurrentPassword("");
      router.refresh();
    } catch (err) {
      console.error(err);
      setError("Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  if (itemCount === 0 && !done) {
    return <p className="text-text-2 text-sm">Nothing connected — there's no data to wipe.</p>;
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <p className="text-[15px] text-text">
        Disconnects all {itemCount} connected institution{itemCount === 1 ? "" : "s"} and permanently deletes every
        account, transaction, and holding stored locally. Your login stays intact — you'll land on an empty app, not
        get signed out.
      </p>
      <div className="flex flex-col gap-1.5">
        <label className={labelClass} htmlFor="wipe-confirm">
          Type {CONFIRM_PHRASE} to confirm
        </label>
        <input
          id="wipe-confirm"
          className={inputClass}
          value={confirmText}
          onChange={(e) => setConfirmText(e.target.value)}
          placeholder={CONFIRM_PHRASE}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label className={labelClass} htmlFor="wipe-password">
          Current password
        </label>
        <input
          id="wipe-password"
          type="password"
          autoComplete="current-password"
          className={inputClass}
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
        />
      </div>
      {error && <p className="text-sm text-negative">{error}</p>}
      {done && <p className="text-sm text-positive">All data wiped.</p>}
      <div>
        <Button type="submit" variant="destructive" size="sm" disabled={!canSubmit}>
          {loading ? "Wiping…" : "Wipe all data"}
        </Button>
      </div>
    </form>
  );
}
