"use client";

import { AlertTriangle, X } from "lucide-react";
import { joinLabels } from "@tally/core/syncDialog";
import { Button } from "@/components/ui/Button";

export interface FailureBannerItem {
  institutionName: string | null;
  labels: string[];
}

function headline(items: FailureBannerItem[]): string {
  if (items.length === 1) {
    const [item] = items;
    return `Couldn't get ${joinLabels(item!.labels)} from ${item!.institutionName ?? "your bank"}`;
  }
  return `${items.length} banks didn't send everything`;
}

/**
 * A sync that partly failed, or didn't run (DESIGN.md §8: sync failure is a
 * persistent banner). A headline says what's missing and from where, one
 * line says what happens next, and Try again re-runs the same sync when the
 * caller can. With several banks, each gets its own line.
 */
export function FailureBanner({
  items,
  message = null,
  onDismiss,
  onRetry,
  retrying = false,
}: {
  items: FailureBannerItem[];
  /** The whole sync didn't run; shown as the headline instead. */
  message?: string | null;
  onDismiss: () => void;
  onRetry?: () => void;
  retrying?: boolean;
}) {
  if (items.length === 0 && !message) return null;

  return (
    <div
      role="status"
      className="flex items-start gap-3 rounded-card border px-4 py-3.5 bg-warning-subtle"
      style={{ borderColor: "color-mix(in srgb, var(--warning) 30%, transparent)" }}
    >
      <AlertTriangle size={18} strokeWidth={1.75} className="text-warning flex-none mt-0.5" />
      <div className="flex-1 min-w-0 flex flex-col gap-1">
        <span className="text-[14px] font-semibold text-text">{message ?? headline(items)}</span>
        {!message && items.length > 1 && (
          <ul className="m-0 pl-0 list-none flex flex-col gap-0.5 text-[13.5px] text-text-2">
            {items.map((item, i) => (
              <li key={i}>
                {item.institutionName ?? "A bank"}: {joinLabels(item.labels)}
              </li>
            ))}
          </ul>
        )}
        <span className="text-[13.5px] leading-snug text-text-2">
          {message
            ? "Check your connection and try again."
            : "This is usually a short outage on the bank's side. Tally tries again on its next sync, so what's shown may be a little out of date until then."}
        </span>
      </div>
      <div className="flex items-center gap-1 flex-none -my-0.5">
        {onRetry && (
          <Button variant="secondary" size="sm" loading={retrying} onClick={onRetry}>
            Try again
          </Button>
        )}
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          title="Dismiss"
          className="w-[30px] h-[30px] rounded-control flex items-center justify-center text-text-3 hover:text-text hover:bg-sunken"
        >
          <X size={15} strokeWidth={1.75} />
        </button>
      </div>
    </div>
  );
}
