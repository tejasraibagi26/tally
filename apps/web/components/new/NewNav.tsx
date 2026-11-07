"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const SECTIONS = [
  { label: "Now", href: "/new", match: (p: string) => p === "/new" },
  { label: "Plans", href: "/new/plans", match: (p: string) => p.startsWith("/new/plans") || p.startsWith("/new/bills") },
  { label: "Everything", href: "/new/accounts", match: (p: string) => p.startsWith("/new/accounts") || p.startsWith("/new/activity") },
];

/** The new Tally's three places: what's happening, what's planned, and everything else. */
export function NewNav() {
  const path = usePathname() ?? "/new";
  return (
    <nav className="tn-nav" aria-label="Main">
      {SECTIONS.map((s) => (
        <Link key={s.href} href={s.href} aria-current={s.match(path) ? "page" : undefined}>
          {s.label}
        </Link>
      ))}
    </nav>
  );
}

const TABS: Record<string, { label: string; href: string }[]> = {
  plans: [
    { label: "Goals & budgets", href: "/new/plans" },
    { label: "Bills & subscriptions", href: "/new/bills" },
  ],
  everything: [
    { label: "Accounts", href: "/new/accounts" },
    { label: "Activity", href: "/new/activity" },
  ],
};

/** The second row under Plans and Everything. */
export function NewSubNav({ section }: { section: keyof typeof TABS }) {
  const path = usePathname() ?? "";
  return (
    <nav className="tn-sub" aria-label={section === "plans" ? "Plans" : "Everything"}>
      {TABS[section]!.map((t) => (
        <Link key={t.href} href={t.href} aria-current={path.startsWith(t.href) ? "page" : undefined}>
          {t.label}
        </Link>
      ))}
    </nav>
  );
}

/** The tally-mark logo with its lime stroke. */
export function NewMark({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={(size * 18) / 24} viewBox="0 0 24 18" aria-hidden="true">
      <g stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
        <line x1="4" y1="3" x2="4" y2="15" />
        <line x1="9" y1="3" x2="9" y2="15" />
        <line x1="14" y1="3" x2="14" y2="15" />
        <line x1="19" y1="3" x2="19" y2="15" />
      </g>
      <line x1="1.5" y1="13.5" x2="22.5" y2="4.5" stroke="#c9f26b" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}
