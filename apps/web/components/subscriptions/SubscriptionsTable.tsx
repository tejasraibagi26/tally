"use client";

import { formatCents } from "@tally/core/money";
import { StatusBadge, type Status } from "@/components/ui/StatusBadge";
import { NextDueDateEditor } from "@/components/subscriptions/NextDueDateEditor";
import { AmortizeToggle } from "@/components/subscriptions/AmortizeToggle";
import { RemoveBillButton } from "@/components/subscriptions/RemoveBillButton";
import { accountDisplayName } from "@tally/core/accountName";

const FREQUENCY_LABEL: Record<string, string> = {
  weekly: "Weekly",
  biweekly: "Every 2 weeks",
  monthly: "Monthly",
  quarterly: "Quarterly",
  annual: "Annual",
};

function statusBadge(status: string): Status {
  if (status === "active") return "good";
  if (status === "at_risk") return "warning";
  return "critical"; // cancelled
}

export interface SubscriptionStream {
  id: string;
  description: string | null;
  merchantKey: string;
  averageAmount: number;
  frequency: string;
  predictedNextDate: string | null;
  manualNextDueDate: string | null;
  status: string;
  isManual: boolean;
  amortizeMonthly: boolean;
  accountName: string | null;
  accountNickname: string | null;
  accountMask: string | null;
  categoryName: string | null;
  categoryColorSlot: number | null;
}

// Tailwind's scanner needs each arbitrary-value class written out literally
// wherever it's used (a JS variable interpolated into the string won't be
// picked up), hence the same grid-cols-[...] spec repeated verbatim in both
// the header row and each data row below. Sized to fit without horizontal
// scroll at a normal desktop width now that "Next date" is just a plain
// timestamp (its edit form lives in a popover anchored off the Actions
// column's pencil icon instead of an inline cell — see NextDueDateEditor.tsx).
export function SubscriptionsTable({ streams }: { streams: SubscriptionStream[] }) {
  return (
    <div className="overflow-x-auto">
      <div className="grid grid-cols-[minmax(180px,1fr)_140px_160px_120px_110px_110px_140px_80px] gap-3 items-center px-4 py-2.5 bg-surface-2 border-b border-border text-xs font-medium uppercase tracking-wide text-text-3 min-w-[1160px]">
        <span>Merchant</span>
        <span>Category</span>
        <span>Account</span>
        <span>Cadence</span>
        <span className="text-right">Amount</span>
        <span>Next date</span>
        <span>Status</span>
        <span>Actions</span>
      </div>
      {streams.map((s) => (
        <div
          key={s.id}
          className="grid grid-cols-[minmax(180px,1fr)_140px_160px_120px_110px_110px_140px_80px] gap-3 items-center px-4 py-3.5 border-b border-border last:border-b-0 min-w-[1160px]"
        >
          <span className="flex flex-col min-w-0">
            <span className="text-[15px] text-text truncate">{s.description ?? s.merchantKey}</span>
            {s.frequency === "annual" && s.averageAmount < 0 && <AmortizeToggle streamId={s.id} amortizeMonthly={s.amortizeMonthly} />}
          </span>
          <span className="flex items-center gap-1.5 min-w-0">
            {s.categoryName ? (
              <>
                <span className="w-1.5 h-1.5 rounded-full flex-none" style={{ background: `var(--series-${s.categoryColorSlot})` }} />
                <span className="text-[13px] text-text-2 truncate">{s.categoryName}</span>
              </>
            ) : (
              <span className="text-[13px] text-text-3">—</span>
            )}
          </span>
          <span className="font-mono text-xs text-text-2 truncate">
            {s.accountName ? `${accountDisplayName(s.accountName, s.accountNickname)} ····${s.accountMask ?? "----"}` : "—"}
          </span>
          <span className="text-[13.5px] text-text-2">{FREQUENCY_LABEL[s.frequency] ?? s.frequency}</span>
          <span className={`text-right text-[15px] tabular ${s.averageAmount > 0 ? "text-positive" : "text-text"}`}>
            {formatCents(s.averageAmount, { signed: true })}
          </span>
          <span className="font-mono text-xs text-text-2 tabular whitespace-nowrap">{s.manualNextDueDate ?? s.predictedNextDate ?? "—"}</span>
          <span className="min-w-0">
            {s.manualNextDueDate ? (
              // "Manual" (removable) is a real "+ Add a bill" entry; an
              // auto-detected stream whose due date was merely overridden
              // isn't the same thing — same badge color would otherwise look
              // identical to a removable bill right next to a Remove action
              // that never appears for it.
              <StatusBadge status="syncing" label={s.isManual ? "Manual" : "Overridden"} />
            ) : (
              <StatusBadge status={statusBadge(s.status)} label={s.status === "active" ? "Active" : s.status === "at_risk" ? "At risk" : "Cancelled"} />
            )}
          </span>
          <span className="flex items-center gap-1">
            <NextDueDateEditor streamId={s.id} predictedNextDate={s.predictedNextDate} manualNextDueDate={s.manualNextDueDate} />
            <RemoveBillButton streamId={s.id} description={s.description ?? s.merchantKey} isManual={s.isManual} />
          </span>
        </div>
      ))}
    </div>
  );
}
