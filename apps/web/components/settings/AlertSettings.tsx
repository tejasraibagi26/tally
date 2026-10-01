"use client";

import { useState } from "react";
import Link from "next/link";
import { PieChart, Landmark, Receipt, Repeat, type LucideIcon } from "lucide-react";
import type { AlertType } from "@tally/core/alerts";
import type { AlertHistoryItem } from "@/lib/alerts/history";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";

type Channels = { push: boolean; email: boolean };

export interface AlertSettingsProps {
  initial: { channels: Record<AlertType, Channels>; largeTransactionCents: number; showAmounts: boolean };
  pushDevices: number;
  history: AlertHistoryItem[];
}

const TYPES: { type: AlertType; label: string; description: string; icon: LucideIcon }[] = [
  { type: "budget_threshold", label: "Budgets", description: "When a budget reaches 80% and 100% this month.", icon: PieChart },
  { type: "large_transaction", label: "Large purchases", description: "When a charge is over your threshold, or about 3× what you usually spend there.", icon: Receipt },
  { type: "subscription_change", label: "Subscriptions", description: "When a new subscription appears or one gets more expensive.", icon: Repeat },
  { type: "connection_broken", label: "Connections", description: "When a bank needs you to sign in again.", icon: Landmark },
];
const ICON_BY_TYPE = Object.fromEntries(TYPES.map((t) => [t.type, t.icon])) as Record<AlertType, LucideIcon>;

function Switch({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn("relative h-6 w-11 flex-none rounded-full transition-colors disabled:opacity-60", checked ? "bg-brand" : "bg-border-strong")}
    >
      <span className={cn("absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform", checked && "translate-x-5")} />
    </button>
  );
}

function relativeTime(iso: string): string {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

async function patchPrefs(body: unknown): Promise<boolean> {
  try {
    const res = await fetch("/api/alerts/preferences", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    return res.ok;
  } catch {
    return false;
  }
}

export function AlertSettings({ initial, pushDevices, history: initialHistory }: AlertSettingsProps) {
  const [channels, setChannels] = useState(initial.channels);
  const [showAmounts, setShowAmounts] = useState(initial.showAmounts);
  const [threshold, setThreshold] = useState(String(initial.largeTransactionCents / 100));
  const [savedThreshold, setSavedThreshold] = useState(initial.largeTransactionCents);
  const [thresholdMsg, setThresholdMsg] = useState<string | null>(null);
  const [testType, setTestType] = useState<AlertType>("budget_threshold");
  const [testMsg, setTestMsg] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const [history, setHistory] = useState(initialHistory);

  async function setChannel(type: AlertType, key: keyof Channels, value: boolean) {
    const prev = channels;
    setChannels({ ...channels, [type]: { ...channels[type], [key]: value } });
    if (!(await patchPrefs({ channels: { [type]: { [key]: value } } }))) setChannels(prev);
  }

  async function toggleShowAmounts(value: boolean) {
    setShowAmounts(value);
    if (!(await patchPrefs({ showAmounts: value }))) setShowAmounts(!value);
  }

  async function saveThreshold() {
    const cents = Math.round(Number(threshold) * 100);
    if (!Number.isFinite(cents) || cents < 1_000 || cents > 10_000_000) {
      setThresholdMsg("Enter an amount from $10 to $100,000.");
      return;
    }
    if (cents === savedThreshold) return;
    if (await patchPrefs({ largeTransactionCents: cents })) {
      setSavedThreshold(cents);
      setThresholdMsg("Saved");
    } else {
      setThresholdMsg("Couldn't save. Try again.");
    }
  }

  async function sendTest() {
    setTesting(true);
    setTestMsg(null);
    try {
      const res = await fetch("/api/alerts/test", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: testType }) });
      const data = (await res.json()) as { error?: string; emailSent?: boolean; pushDevices?: number | null; channels?: Channels };
      if (!res.ok) {
        setTestMsg(data.error ?? "Couldn't send the test alert.");
        return;
      }
      const parts: string[] = [];
      if ((data.pushDevices ?? 0) > 0) parts.push(`to ${data.pushDevices} phone${data.pushDevices === 1 ? "" : "s"}`);
      if (data.emailSent) parts.push("by email");
      if (parts.length > 0) setTestMsg(`Sent ${parts.join(" and ")}.`);
      else if (data.channels?.push && !data.channels.email) setTestMsg("Nothing sent: no phone is connected yet, and email is off for this alert.");
      else setTestMsg("Couldn't send the test alert. Try again in a moment.");
      const h = await fetch("/api/alerts?limit=10").then((r) => (r.ok ? r.json() : null)).catch(() => null);
      if (h?.alerts) setHistory(h.alerts);
    } catch {
      setTestMsg("Couldn't send the test alert.");
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className="flex flex-col divide-y divide-border">
      <div className="p-5 flex flex-col gap-4">
        <p className="text-[13.5px] text-text-2">
          Tally lets you know when something needs a look. Each alert is sent once.{" "}
          {pushDevices === 0
            ? "No phone is connected yet, so push alerts will start once you turn on notifications in the Tally app."
            : `Push goes to ${pushDevices} phone${pushDevices === 1 ? "" : "s"}, and waits until 8 AM if it arrives overnight.`}
        </p>

        <div className="flex flex-col">
          <div className="flex items-center justify-end gap-6 pb-2 pr-0.5 text-xs font-medium uppercase tracking-[0.06em] text-text-3">
            <span className="w-11 text-center">Push</span>
            <span className="w-11 text-center">Email</span>
          </div>
          {TYPES.map(({ type, label, description, icon: Icon }) => (
            <div key={type} className="flex items-center gap-4 py-3 border-t border-border">
              <Icon size={17} strokeWidth={1.75} className="text-text-3 flex-none" />
              <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                <span className="text-[15px] text-text">{label}</span>
                <span className="text-[13.5px] text-text-2">{description}</span>
              </div>
              <div className="flex items-center gap-6 flex-none">
                <Switch checked={channels[type].push} onChange={(v) => setChannel(type, "push", v)} label={`${label}: push`} />
                <Switch checked={channels[type].email} onChange={(v) => setChannel(type, "email", v)} label={`${label}: email`} />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="p-5 flex flex-col gap-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <label htmlFor="large-threshold" className="flex flex-col gap-0.5">
            <span className="text-[15px] text-text">Large purchase threshold</span>
            <span className="text-[13.5px] text-text-2">Any single charge at or above this alerts.</span>
          </label>
          <div className="flex flex-col items-end gap-1">
            <div className="flex items-center h-9 rounded-control border border-border-strong bg-surface px-3 focus-within:ring-2 focus-within:ring-info focus-within:ring-offset-2 focus-within:ring-offset-surface">
              <span className="text-text-3 text-[15px] pr-1">$</span>
              <input
                id="large-threshold"
                inputMode="decimal"
                value={threshold}
                onChange={(e) => {
                  setThreshold(e.target.value.replace(/[^\d.]/g, ""));
                  setThresholdMsg(null);
                }}
                onBlur={saveThreshold}
                onKeyDown={(e) => e.key === "Enter" && (e.currentTarget as HTMLInputElement).blur()}
                className="w-24 bg-transparent text-right text-[15px] tabular outline-none"
              />
            </div>
            {thresholdMsg && <span className={cn("text-xs", thresholdMsg === "Saved" ? "text-text-3" : "text-negative")}>{thresholdMsg}</span>}
          </div>
        </div>

        <div className="flex items-center justify-between gap-4">
          <div className="flex flex-col gap-0.5">
            <span className="text-[15px] text-text">Show amounts in notifications</span>
            <span className="text-[13.5px] text-text-2">Turn off to keep dollar figures off your lock screen. Emails always include them.</span>
          </div>
          <Switch checked={showAmounts} onChange={toggleShowAmounts} label="Show amounts in notifications" />
        </div>

        <div className="flex items-center justify-between gap-4 flex-wrap">
          <label htmlFor="test-alert-type" className="flex flex-col gap-0.5">
            <span className="text-[15px] text-text">Send a test alert</span>
            <span className="text-[13.5px] text-text-2">Uses the push and email settings above for that alert.</span>
          </label>
          <div className="flex items-center gap-2">
            <select
              id="test-alert-type"
              value={testType}
              onChange={(e) => setTestType(e.target.value as AlertType)}
              className="h-9 rounded-control border border-border-strong bg-surface px-2.5 text-[14px] text-text"
            >
              {TYPES.map((t) => (
                <option key={t.type} value={t.type}>
                  {t.label}
                </option>
              ))}
            </select>
            <Button variant="secondary" size="sm" disabled={testing} onClick={sendTest}>
              {testing ? "Sending…" : "Send test"}
            </Button>
          </div>
        </div>
        {testMsg && <p className="text-[13.5px] text-text-2 -mt-1">{testMsg}</p>}
      </div>

      <div className="p-5 flex flex-col gap-3">
        <span className="text-xs font-medium uppercase tracking-[0.06em] text-text-3">Recent alerts</span>
        {history.length === 0 ? (
          <p className="text-[13.5px] text-text-3">{"No alerts yet. They'll show up here as they're sent."}</p>
        ) : (
          <ul className="flex flex-col">
            {history.map((a) => {
              const Icon = ICON_BY_TYPE[a.type];
              const content = (
                <>
                  <Icon size={16} strokeWidth={1.75} className="text-text-3 flex-none mt-0.5" />
                  <span className="flex flex-col gap-0.5 min-w-0 flex-1">
                    <span className="text-[14px] text-text">{a.title}</span>
                    <span className="text-[13px] text-text-2">{a.body}</span>
                  </span>
                  <span className="flex flex-col items-end gap-1 flex-none">
                    <span className="text-xs text-text-3 tabular">{relativeTime(a.createdAt)}</span>
                    <span className="flex gap-1">
                      {a.test && <span className="text-[11px] px-1.5 py-0.5 rounded bg-sunken text-text-2">Test</span>}
                      {a.push && <span className="text-[11px] px-1.5 py-0.5 rounded bg-sunken text-text-2">Push</span>}
                      {a.email && <span className="text-[11px] px-1.5 py-0.5 rounded bg-sunken text-text-2">Email</span>}
                    </span>
                  </span>
                </>
              );
              return (
                <li key={a.id} className="border-t border-border first:border-t-0">
                  {a.url ? (
                    <Link href={a.url} className="flex items-start gap-3 py-2.5 -mx-2 px-2 rounded-control hover:bg-surface-2">
                      {content}
                    </Link>
                  ) : (
                    <div className="flex items-start gap-3 py-2.5">{content}</div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
