"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  X,
  LayoutDashboard,
  Receipt,
  PieChart,
  Repeat,
  ListFilter,
  Landmark,
  TrendingUp,
  CreditCard,
  Flame,
  Settings,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { LogoMark } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { PrivacyToggle } from "@/components/PrivacyToggle";
import { SignOutButton } from "@/components/nav/SignOutButton";
import { APP_VERSION, BUILD_SHA } from "@/lib/version";

/**
 * Pixel-matched to the Claude Design canvas (TallyNav.dc.html): 240px shell,
 * 24px/16px padding, 24px gaps between sections, grouped nav with item
 * counts, footer profile row. Values below are lifted straight from that
 * file's inline styles — don't round them to the nearest Tailwind step.
 */

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  meta?: string;
  /** Replaces `meta` with a colored count pill (coral = blocked, amber = act soon). */
  alert?: { count: number; tone: "negative" | "warning"; title: string };
}

interface NavGroup {
  /** Omitted for the lone Overview block at the top. */
  label?: string;
  items: NavItem[];
}

export interface NavCounts {
  transactions: number;
  accounts: number;
  creditCards: number;
  /** Banks needing a tap (lib/connectionState via the app layout), so a broken one shows from any page. */
  accountsAttention?: { count: number; blocked: boolean; names: string[] };
}

// Grouped by what the money is doing, not by page type: what you have and
// what you owe are separate blocks (credit cards used to sit under
// "Assets"), and the retirement planner is its own "Plan ahead" block.
function navGroups(counts: NavCounts): NavGroup[] {
  return [
    { items: [{ href: "/overview", label: "Overview", icon: LayoutDashboard }] },
    {
      label: "Your money",
      items: [
        { href: "/transactions", label: "Transactions", icon: Receipt, meta: String(counts.transactions) },
        { href: "/budgets", label: "Budgets", icon: PieChart },
        { href: "/subscriptions", label: "Subscriptions", icon: Repeat },
        { href: "/rules", label: "Rules", icon: ListFilter },
      ],
    },
    {
      label: "What you have",
      items: [
        {
          href: "/accounts",
          label: "Accounts",
          icon: Landmark,
          meta: String(counts.accounts),
          alert: counts.accountsAttention?.count
            ? {
                count: counts.accountsAttention.count,
                tone: counts.accountsAttention.blocked ? "negative" : "warning",
                title: `Needs you: ${counts.accountsAttention.names.join(", ")}`,
              }
            : undefined,
        },
        { href: "/investments", label: "Investments", icon: TrendingUp },
      ],
    },
    { label: "What you owe", items: [{ href: "/cards", label: "Credit cards", icon: CreditCard, meta: String(counts.creditCards) }] },
    { label: "Plan ahead", items: [{ href: "/fire", label: "Early retirement", icon: Flame }] },
  ];
}

function NavRow({ item, active }: { item: NavItem; active: boolean }) {
  return (
    <Link
      href={item.href}
      className={cn(
        "flex items-center justify-between px-2.5 py-2 rounded-control text-[15px]",
        active ? "bg-brand-subtle text-brand font-medium" : "text-text-2 font-normal hover:bg-sunken",
      )}
    >
      <span className="flex items-center gap-2.5 min-w-0">
        <item.icon size={17} strokeWidth={1.75} className="flex-none" />
        <span className="truncate">{item.label}</span>
      </span>
      {item.alert ? (
        <span
          title={item.alert.title}
          aria-label={item.alert.title}
          className={cn(
            "min-w-[18px] h-[18px] px-1.5 rounded-full text-[11px] font-semibold leading-none flex items-center justify-center text-on-brand",
            item.alert.tone === "negative" ? "bg-negative" : "bg-warning",
          )}
        >
          {item.alert.count}
        </span>
      ) : (
        item.meta &&
        item.meta !== "0" && <span className="font-mono text-[12.5px] leading-none text-text-3">{item.meta}</span>
      )}
    </Link>
  );
}

function initials(name: string | null, email: string): string {
  if (name?.trim()) {
    const parts = name.trim().split(/\s+/);
    return parts.length > 1 ? (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase() : parts[0]!.slice(0, 2).toUpperCase();
  }
  return email.slice(0, 2).toUpperCase();
}

/** Prefer the account name; fall back to the email's local part rather than the full address. */
function displayName(name: string | null, email: string): string {
  if (name?.trim()) return name.trim();
  return email.split("@")[0] || email;
}

export function SideNav({
  user,
  counts,
  mockMode,
  onClose,
}: {
  user: { name: string | null; email: string };
  counts: NavCounts;
  mockMode: boolean;
  /** Present only when rendered inside the mobile drawer (components/nav/MobileNav.tsx) — shows a close button. */
  onClose?: () => void;
}) {
  const pathname = usePathname();
  const isActive = (href: string) => pathname?.startsWith(href) ?? false;

  return (
    <nav className="w-60 h-full flex-none bg-surface border-r border-border px-4 py-6 flex flex-col gap-6 overflow-y-auto">
      <div className="flex items-center justify-between gap-2 px-2">
        <div className="flex items-center gap-2">
          <LogoMark size={22} />
          <span className="font-display text-2xl leading-none text-text">Tally</span>
        </div>
        {onClose && (
          <button onClick={onClose} aria-label="Close menu" title="Close menu" className="w-7 h-7 flex items-center justify-center text-text-3 hover:text-text">
            <X size={18} strokeWidth={1.75} />
          </button>
        )}
      </div>

      <div className="flex flex-col gap-4">
        {navGroups(counts).map((group, i) => (
          <div key={group.label ?? "top"} className="flex flex-col gap-4">
            {i > 0 && <div className="h-px bg-border mx-2" />}
            <div className="flex flex-col gap-[2px]">
              {group.label && (
                <div className="text-xs font-medium uppercase tracking-[0.06em] text-text-3 px-2 pb-2">{group.label}</div>
              )}
              {group.items.map((item) => (
                <NavRow key={item.href} item={item} active={isActive(item.href)} />
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-auto flex flex-col gap-3">
        <div className="h-px bg-border" />

        {mockMode && (
          <span className="self-start inline-flex items-center gap-1.5 rounded-full bg-warning-subtle text-warning text-xs font-medium px-2.5 py-0.5">
            Mock data
          </span>
        )}

        {/* Display preferences as one more nav section: labeled rows in the
            same style as the links above. Account actions (Settings, Sign
            out) live on the profile row below. */}
        <div className="flex flex-col gap-[2px]">
          <PrivacyToggle variant="row" />
          <ThemeToggle variant="row" />
        </div>

        <div className="h-px bg-border" />

        <div
          className={cn(
            "flex items-center gap-1 px-2 py-2 -mx-2 rounded-control",
            isActive("/settings") && "bg-sunken",
          )}
        >
          <Link href="/settings" className="flex items-center gap-2.5 min-w-0 flex-1">
            <div className="w-7 h-7 flex-none rounded-full bg-sunken border border-border flex items-center justify-center text-xs font-medium text-text-2">
              {initials(user.name, user.email)}
            </div>
            <div className="flex flex-col gap-0.5 min-w-0">
              <span className="text-[13.5px] font-medium leading-none text-text truncate">
                {displayName(user.name, user.email)}
              </span>
              <span className="text-xs leading-none text-text-3">Private</span>
            </div>
          </Link>
          <Link
            href="/settings"
            aria-label="Settings"
            title="Settings"
            className="w-8 h-8 flex-none rounded-control flex items-center justify-center text-text-3 hover:text-text hover:bg-sunken transition-colors"
          >
            <Settings size={16} strokeWidth={1.75} />
          </Link>
          <SignOutButton />
        </div>

        {/* A native `title` alone is unreliable here (some browsers need a
            long, uninterrupted hover before it appears, some suppress it
            inside a scroll container) -- this pairs it with a CSS-only
            tooltip bubble that shows on :hover/:focus immediately, no JS. */}
        <div className="pt-2.5 border-t border-border flex justify-center">
          <span className="relative group/version">
            <span
              tabIndex={0}
              title={`Tally version ${APP_VERSION}, build ${BUILD_SHA}`}
              className="flex items-center gap-1.5 font-mono text-[10.5px] tracking-[0.03em] text-text-3 cursor-default"
            >
              <span className="uppercase text-text-3/70">Build</span>
              <span className="text-text-2">v{APP_VERSION}</span>
              <span className="text-text-3/50">·</span>
              <span className="text-text-3/70">{BUILD_SHA}</span>
            </span>
            <span
              role="tooltip"
              className="pointer-events-none absolute left-1/2 bottom-full mb-1.5 -translate-x-1/2 whitespace-nowrap rounded-control bg-text px-2 py-1 text-[11px] font-sans text-canvas opacity-0 transition-opacity duration-100 group-hover/version:opacity-100 group-focus-within/version:opacity-100 z-30"
            >
              Tally version {APP_VERSION}, build {BUILD_SHA}
            </span>
          </span>
        </div>
      </div>
    </nav>
  );
}
