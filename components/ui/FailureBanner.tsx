"use client";

import { X } from "lucide-react";

/** Joins ["transactions", "credit card details"] as "transactions and credit card details", and 3+ with commas + "and". */
function joinLabels(labels: string[]): string {
  if (labels.length <= 1) return labels[0] ?? "";
  if (labels.length === 2) return `${labels[0]} and ${labels[1]}`;
  return `${labels.slice(0, -1).join(", ")}, and ${labels[labels.length - 1]}`;
}

export interface FailureBannerItem {
  institutionName: string | null;
  labels: string[];
}

/** One dismissible line per affected institution: "Couldn't fetch transactions and credit card details for TD Canada Trust." */
export function FailureBanner({ items, onDismiss }: { items: FailureBannerItem[]; onDismiss: () => void }) {
  if (items.length === 0) return null;

  return (
    <div className="flex items-start gap-3 px-4 py-3 rounded-control bg-warning-subtle text-[13.5px] text-text">
      <div className="flex-1 flex flex-col gap-1">
        {items.map((item, i) => (
          <span key={i}>
            Could not fetch {joinLabels(item.labels)}
            {item.institutionName ? ` for ${item.institutionName}` : ""}. Plaid may be temporarily unavailable. It will
            retry automatically.
          </span>
        ))}
      </div>
      <button type="button" onClick={onDismiss} aria-label="Dismiss" className="text-text-3 hover:text-text flex-none">
        <X size={14} strokeWidth={1.75} />
      </button>
    </div>
  );
}
