"use client";

import { useState } from "react";
import Link from "next/link";
import { PieChart, Landmark, Receipt, Repeat, type LucideIcon } from "lucide-react";
import type { AlertType } from "@tally/core/alerts";
import type { AlertHistoryItem } from "@/lib/alerts/history";
import { Switch } from "@/components/ui/Switch";
import { SettingsBlock, SettingsGroup, SettingsRow } from "@/components/settings/SettingsLayout";
import { showToast } from "@/lib/toast";
import { cn } from "@/lib/cn";

type Channels = { email: boolean };

export interface AlertSettingsProps {
  initial: { channels: Record<AlertType, Channels>; largeTransactionCents: number };
  history: AlertHistoryItem[];
  recapsEnabled: boolean;
}

const TYPES: { type: AlertType; label: string; description: string; icon: LucideIcon }[] = [
  { type: "budget_threshold", label: "Budgets", description: "At 80% and 100% of a budget this month", icon: PieChart },
  { type: "large_transaction", label: "Large purchases", description: "A charge over your threshold, or about 3× what you usually spend there", icon: Receipt },
  { type: "subscription_change", label: "Subscriptions", description: "A new subscription appears or one gets more expensive", icon: Repeat },
  { type: "connection_broken", label: "Connections", description: "A bank needs you to sign in again", icon: Landmark },
];
const ICON_BY_TYPE = Object.fromEntries(TYPES.map((t) => [t.type, t.icon])) as Record<AlertType, LucideIcon>;

/** Recent alerts shown before "Show all". */
const HISTORY_PREVIEW = 2;
const SAVE_FAILED = "Couldn't save that. Check your connection and try again.";

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

async function patch(url: string, body: unknown): Promise<boolean> {
  try {
    const res = await fetch(url, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Settings' Notifications group (#alerts is the alert emails' "Manage alerts"
 * target): the monthly recap and each alert type as a switch row that saves
 * on toggle -- flipping back with a toast if the save fails -- the
 * large-purchase threshold inline on its row, and recent alerts collapsed
 * to the last two.
 */
export function AlertSettings({ initial, history, recapsEnabled: initialRecaps }: AlertSettingsProps) {
  const [recaps, setRecaps] = useState(initialRecaps);
  const [channels, setChannels] = useState(initial.channels);
  const [threshold, setThreshold] = useState(String(initial.largeTransactionCents / 100));
  const [savedThreshold, setSavedThreshold] = useState(initial.largeTransactionCents);
  const [thresholdError, setThresholdError] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  async function toggleRecaps(next: boolean) {
    setRecaps(next);
    if (!(await patch("/api/settings/recaps", { enabled: next }))) {
      setRecaps(!next);
      showToast(SAVE_FAILED, "negative");
    }
  }

  async function setEmail(type: AlertType, value: boolean) {
    const prev = channels;
    setChannels({ ...channels, [type]: { email: value } });
    if (!(await patch("/api/alerts/preferences", { channels: { [type]: { email: value } } }))) {
      setChannels(prev);
      showToast(SAVE_FAILED, "negative");
    }
  }

  async function saveThreshold() {
    const cents = Math.round(Number(threshold) * 100);
    if (!Number.isFinite(cents) || cents < 1_000 || cents > 10_000_000) {
      setThresholdError("Enter an amount from $10 to $100,000.");
      return;
    }
    if (cents === savedThreshold) return;
    if (await patch("/api/alerts/preferences", { largeTransactionCents: cents })) {
      setSavedThreshold(cents);
      showToast(`Large purchase alerts start at $${(cents / 100).toLocaleString("en-US")}`);
    } else {
      setThresholdError("Couldn't save the threshold. Try again.");
    }
  }

  const shown = showAll ? history : history.slice(0, HISTORY_PREVIEW);

  return (
    <SettingsGroup id="alerts" title="Notifications" description="Everything Tally sends goes to your email. Each alert is sent once.">
      <SettingsRow title="Monthly recap" description="Income, spend, budgets and net worth, on the 1st of each month">
        <Switch checked={recaps} onChange={toggleRecaps} label="Monthly recap email" />
      </SettingsRow>

      {TYPES.map(({ type, label, description }) => (
        <SettingsRow key={type} title={label} description={description} htmlFor={type === "large_transaction" ? "large-threshold" : undefined}>
          {type === "large_transaction" && (
            <div className="flex flex-col items-end gap-1">
              <div
                className={cn(
                  "flex items-center h-8 rounded-control border bg-surface px-2.5 focus-within:ring-2 focus-within:ring-info focus-within:ring-offset-2 focus-within:ring-offset-surface",
                  thresholdError ? "border-negative" : "border-border-strong",
                )}
              >
                <span className="text-text-3 text-[14px] pr-1">$</span>
                <input
                  id="large-threshold"
                  inputMode="decimal"
                  value={threshold}
                  aria-label="Large purchase threshold"
                  aria-invalid={thresholdError ? true : undefined}
                  onChange={(e) => {
                    setThreshold(e.target.value.replace(/[^\d.]/g, ""));
                    setThresholdError(null);
                  }}
                  onBlur={saveThreshold}
                  onKeyDown={(e) => e.key === "Enter" && (e.currentTarget as HTMLInputElement).blur()}
                  className="w-20 bg-transparent text-right text-[14px] tabular outline-none"
                />
              </div>
              {thresholdError && <span role="alert" className="text-xs text-negative">{thresholdError}</span>}
            </div>
          )}
          <Switch checked={channels[type].email} onChange={(v) => setEmail(type, v)} label={`Email ${label.toLowerCase()} alerts`} />
        </SettingsRow>
      ))}

      <SettingsBlock className="flex flex-col gap-2">
        <span className="text-xs font-medium uppercase tracking-[0.06em] text-text-3">Recent alerts</span>
        {history.length === 0 ? (
          <p className="m-0 text-[13.5px] text-text-3">No alerts yet. They&apos;ll show up here as they&apos;re sent.</p>
        ) : (
          <>
            <ul className="m-0 p-0 list-none flex flex-col">
              {shown.map((a) => {
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
                      {a.email && (a.email.status === "sent" ? <Tag>Emailed</Tag> : <Tag tone="negative" title={a.email.error}>Email failed</Tag>)}
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
            {history.length > HISTORY_PREVIEW && (
              <button type="button" onClick={() => setShowAll((v) => !v)} aria-expanded={showAll} className="self-start text-[13.5px] font-medium text-brand hover:underline">
                {showAll ? "Show fewer" : `Show all ${history.length} recent alerts`}
              </button>
            )}
          </>
        )}
      </SettingsBlock>
    </SettingsGroup>
  );
}
