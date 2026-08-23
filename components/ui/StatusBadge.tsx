import clsx from "clsx";

export type Status = "good" | "warning" | "serious" | "critical" | "syncing";

const statusConfig: Record<Status, { bg: string; fg: string; label: string; icon: string }> = {
  good: { bg: "bg-positive-subtle", fg: "text-positive", label: "Fresh", icon: "●" },
  warning: { bg: "bg-warning-subtle", fg: "text-warning", label: "Stale", icon: "●" },
  serious: { bg: "bg-warning-subtle", fg: "text-warning", label: "Needs attention", icon: "▲" },
  critical: { bg: "bg-negative-subtle", fg: "text-negative", label: "Broken", icon: "▲" },
  syncing: { bg: "bg-info-subtle", fg: "text-info", label: "Syncing", icon: "●" },
};

export function StatusBadge({ status, label }: { status: Status; label?: string }) {
  const cfg = statusConfig[status];
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1.5 rounded-[6px] px-2.5 py-0.5 text-xs font-medium",
        cfg.bg,
        cfg.fg,
      )}
    >
      <span aria-hidden>{cfg.icon}</span>
      {label ?? cfg.label}
    </span>
  );
}
