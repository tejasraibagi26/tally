"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Switch } from "@/components/ui/Switch";
import { SettingsGroup, SettingsRow } from "@/components/settings/SettingsLayout";
import { showToast } from "@/lib/toast";
import { cn } from "@/lib/cn";

export interface SafeToSpendSettingsProps {
  cushion: number;
  /** Bank accounts, each with whether it counts now (the user's choice or its type's default). */
  accounts: { id: string; label: string; kind: string; counts: boolean }[];
  /** Cards whose bank reports no due date, with the day the user entered (or null). */
  cards: { id: string; label: string; dueDay: number | null }[];
}

const SAVE_FAILED = "Couldn't save that. Check your connection and try again.";

async function put(body: unknown): Promise<boolean> {
  const res = await fetch("/api/safe-to-spend/settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).catch(() => null);
  return !!res?.ok;
}

function AmountField({ id, value, onChange, onSave, error, label, prefix = "$", placeholder }: { id: string; value: string; onChange: (v: string) => void; onSave: () => void; error: string | null; label: string; prefix?: string; placeholder?: string }) {
  return (
    <div className="flex flex-col items-end gap-1">
      <div
        className={cn(
          "flex items-center h-8 rounded-control border bg-surface px-2.5 focus-within:ring-2 focus-within:ring-info focus-within:ring-offset-2 focus-within:ring-offset-surface",
          error ? "border-negative" : "border-border-strong",
        )}
      >
        {prefix && <span className="text-text-3 text-[14px] pr-1">{prefix}</span>}
        <input
          id={id}
          inputMode="decimal"
          value={value}
          placeholder={placeholder}
          aria-label={label}
          aria-invalid={error ? true : undefined}
          onChange={(e) => onChange(e.target.value.replace(/[^\d.]/g, ""))}
          onBlur={onSave}
          onKeyDown={(e) => e.key === "Enter" && (e.currentTarget as HTMLInputElement).blur()}
          className="w-20 bg-transparent text-right text-[14px] tabular outline-none"
        />
      </div>
      {error && <span role="alert" className="text-xs text-negative">{error}</span>}
    </div>
  );
}

function DueDayRow({ card }: { card: SafeToSpendSettingsProps["cards"][number] }) {
  const router = useRouter();
  const [value, setValue] = useState(card.dueDay == null ? "" : card.dueDay === 0 ? "31" : String(card.dueDay));
  const [saved, setSaved] = useState(card.dueDay);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    const day = value.trim() === "" ? null : Number(value);
    if (day != null && (!Number.isInteger(day) || day < 1 || day > 31)) {
      setError("Enter a day from 1 to 31.");
      return;
    }
    // 31 means "the last day", so it lands on Feb 28 and Apr 30 too.
    const stored = day === 31 ? 0 : day;
    if (stored === saved) return;
    if (await put({ dueDays: { [card.id]: stored } })) {
      setSaved(stored);
      router.refresh();
    } else setError(SAVE_FAILED);
  }

  return (
    <SettingsRow title={`${card.label} due day`} description="Your bank doesn't report it, so Tally assumes it's due before payday. Leave it empty to keep assuming." htmlFor={`due-${card.id}`}>
      <AmountField id={`due-${card.id}`} prefix="" placeholder="e.g. 22" value={value} onChange={(v) => { setValue(v); setError(null); }} onSave={save} error={error} label={`${card.label} payment due day`} />
    </SettingsRow>
  );
}

/**
 * Settings → Safe to spend (Tally Pop only, like the Overview card): which
 * bank accounts count as spending money, the cushion, and a due day for
 * any card whose bank doesn't report one. Each saves on its own.
 */
export function SafeToSpendSettings({ cushion: initialCushion, accounts: initialAccounts, cards }: SafeToSpendSettingsProps) {
  const router = useRouter();
  const [accounts, setAccounts] = useState(initialAccounts);
  const [cushion, setCushion] = useState(String(initialCushion / 100));
  const [savedCushion, setSavedCushion] = useState(initialCushion);
  const [cushionError, setCushionError] = useState<string | null>(null);

  async function toggle(id: string, counts: boolean) {
    const prev = accounts;
    setAccounts(accounts.map((a) => (a.id === id ? { ...a, counts } : a)));
    if (await put({ accounts: { [id]: counts } })) router.refresh();
    else {
      setAccounts(prev);
      showToast(SAVE_FAILED, "negative");
    }
  }

  async function saveCushion() {
    const cents = Math.round(Number(cushion || "0") * 100);
    if (!Number.isFinite(cents) || cents < 0 || cents > 10_000_000) {
      setCushionError("Enter an amount from $0 to $100,000.");
      return;
    }
    if (cents === savedCushion) return;
    if (await put({ cushion: cents })) {
      setSavedCushion(cents);
      router.refresh();
    } else setCushionError(SAVE_FAILED);
  }

  return (
    <SettingsGroup id="safe-to-spend" title="Safe to spend" description="Which accounts count as spending money, and how much to always keep back.">
      {accounts.map((a) => (
        <SettingsRow key={a.id} title={a.label} description={a.kind}>
          <Switch checked={a.counts} onChange={(v) => toggle(a.id, v)} label={`Count ${a.label} as spending money`} />
        </SettingsRow>
      ))}
      <SettingsRow title="Cushion" description="Safe to spend never dips into this" htmlFor="cushion-amount">
        <AmountField id="cushion-amount" value={cushion} onChange={(v) => { setCushion(v); setCushionError(null); }} onSave={saveCushion} error={cushionError} label="Cushion amount" />
      </SettingsRow>
      {cards.map((c) => (
        <DueDayRow key={c.id} card={c} />
      ))}
    </SettingsGroup>
  );
}
