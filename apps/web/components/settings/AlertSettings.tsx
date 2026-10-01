"use client";

import { useState } from "react";
import Link from "next/link";
import { PieChart, Landmark, Receipt, Repeat, type LucideIcon } from "lucide-react";
import type { AlertType } from "@tally/core/alerts";
import type { AlertHistoryItem } from "@/lib/alerts/history";
import { cn } from "@/lib/cn";

type Channels = { email: boolean };

export interface AlertSettingsProps {
  initial: { channels: Record<AlertType, Channels>; largeTransactionCents: number };
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

function Tag({ children, tone = "neutral", title }: { children: React.ReactNode; tone?: "neutral" | "negative"; title?: string }) {
  return (
    <span
      title={title}
      className={cn(
        "text-[11px] px-1.5 py-0.5 rounded whitespace-nowrap",
        tone === "negative" ? "bg-negative-subtle text-negative" : "bg-sunken text-text-2",
      )}
    >
      {children}
    </span>
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

export function AlertSettings({ initial, history }: AlertSettingsProps) {
  const [channels, setChannels] = useState(initial.channels);
  const [threshold, setThreshold] = useState(String(initial.largeTransactionCents / 100));
  const [savedThreshold, setSavedThreshold] = useState(initial.largeTransactionCents);
  const [thresholdMsg, setThresholdMsg] = useState<string | null>(null);

  async function setEmail(type: AlertType, value: boolean) {
    const prev = channels;
    setChannels({ ...channels, [type]: { email: value } });
    if (!(await patchPrefs({ channels: { [type]: { email: value } } }))) setChannels(prev);
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

  return (
    <div className="flex flex-col divide-y divide-border">
      <div className="p-5 flex flex-col gap-4">
        <p className="text-[13.5px] text-text-2">Tally emails you when something needs a look. Each alert is sent once.</p>

        <div className="flex flex-col">
          {TYPES.map(({ type, label, description, icon: Icon }) => (
            <div key={type} className="flex items-center gap-4 py-3 border-t border-border first:border-t-0">
              <Icon size={17} strokeWidth={1.75} className="text-text-3 flex-none" />
              <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                <span className="text-[15px] text-text">{label}</span>
                <span className="text-[13.5px] text-text-2">{description}</span>
              </div>
              <Switch checked={channels[type].email} onChange={(v) => setEmail(type, v)} label={`Email ${label.toLowerCase()} alerts`} />
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
                    {a.email?.status === "failed" && <span className="text-xs text-negative">Email didn&apos;t send: {a.email.error}</span>}
                  </span>
                  <span className="flex flex-col items-end gap-1 flex-none">
                    <span className="text-xs text-text-3 tabular">{relativeTime(a.createdAt)}</span>
                    <span className="flex flex-wrap justify-end gap-1">
                      {a.email && (a.email.status === "sent" ? <Tag>Emailed</Tag> : <Tag tone="negative" title={a.email.error}>Email failed</Tag>)}
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
