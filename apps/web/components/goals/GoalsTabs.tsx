import Link from "next/link";
import { cn } from "@/lib/cn";

export type GoalsView = "year" | "retirement";

const TABS: { view: GoalsView; label: string; href: string }[] = [
  { view: "year", label: "Year-end goal", href: "/goals" },
  { view: "retirement", label: "Early retirement", href: "/goals?view=retirement" },
];

/** Goals' two plans, one row of pills under the header (the same pills as Forecast's range). */
export function GoalsTabs({ active }: { active: GoalsView }) {
  return (
    <nav className="-mt-2 flex items-center gap-1.5" aria-label="Goals">
      {TABS.map((t) => (
        <Link
          key={t.view}
          href={t.href}
          aria-current={t.view === active ? "page" : undefined}
          className={cn(
            "ui-btn rounded-full border px-3.5 py-1 text-[13.5px] font-semibold transition-colors",
            t.view === active
              ? "ui-btn-primary border-transparent bg-brand text-on-brand"
              : "ui-btn-secondary border-border-strong bg-surface text-text hover:bg-surface-2",
          )}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
