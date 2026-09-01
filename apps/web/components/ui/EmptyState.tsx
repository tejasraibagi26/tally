import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type Idle = "float" | "spin" | "wiggle";

const IDLE_ANIMATION: Record<Idle, string> = {
  float: "empty-float 3s ease-in-out infinite",
  spin: "empty-spin 6s linear infinite",
  wiggle: "empty-wiggle 2.4s ease-in-out infinite",
};

/**
 * Still "one line of what's missing, one primary action" (DESIGN.md §empty
 * states) — the icon badge is the only addition, not a replacement for that
 * discipline. `compact` is for an empty state embedded in a smaller card
 * (the Overview budget panel) rather than filling a full page. The badge
 * pops in once on mount; the icon then idles with `animation` (small and
 * slow, so it reads as alive rather than distracting — respects
 * prefers-reduced-motion via the global override in globals.css).
 *
 * `illustration` swaps the icon-in-a-circle badge for a fully custom node
 * (e.g. components/transactions/EmptyPeriodIllustration.tsx) for the rare
 * empty state worth a bespoke animated scene rather than a single Lucide
 * icon — it's expected to drive its own pop-in/idle animation, so `icon` and
 * `animation` are ignored when it's passed.
 */
export function EmptyState({
  icon: Icon,
  illustration,
  title,
  description,
  action,
  compact = false,
  animation = "float",
  className,
}: {
  icon?: LucideIcon;
  illustration?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  compact?: boolean;
  animation?: Idle;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center text-center", compact ? "gap-2 py-2" : "gap-3", className)}>
      {illustration ? (
        <div className="flex-none">{illustration}</div>
      ) : (
        Icon && (
          <div
            className={cn(
              "rounded-full bg-brand-subtle flex items-center justify-center flex-none",
              compact ? "w-10 h-10" : "w-14 h-14",
            )}
            style={{ animation: "empty-pop 450ms ease-out" }}
          >
            <Icon
              size={compact ? 18 : 26}
              strokeWidth={1.75}
              className="text-brand"
              style={{ animation: `${IDLE_ANIMATION[animation]}`, animationDelay: "450ms" }}
            />
          </div>
        )
      )}
      <span className={cn("text-text", compact ? "text-[15px] font-medium" : "font-display text-2xl")}>{title}</span>
      {description && <p className="text-text-2 text-[15px] max-w-md">{description}</p>}
      {action}
    </div>
  );
}
