"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";
import { LogoMark } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { PrivacyToggle } from "@/components/PrivacyToggle";
import { SignOutButton } from "@/components/nav/SignOutButton";

/**
 * Pixel-matched to the Claude Design canvas (TallyNav.dc.html): 240px shell,
 * 24px/16px padding, 24px gaps between sections, grouped nav with item
 * counts, footer profile row. Values below are lifted straight from that
 * file's inline styles — don't round them to the nearest Tailwind step.
 */

interface NavItem {
  href: string;
  label: string;
  meta?: string;
}

interface NavCounts {
  transactions: number;
  accounts: number;
  creditCards: number;
}

function moneyItems(counts: NavCounts): NavItem[] {
  return [
    { href: "/overview", label: "Overview" },
    { href: "/transactions", label: "Transactions", meta: String(counts.transactions) },
    { href: "/budgets", label: "Budgets" },
    { href: "/subscriptions", label: "Subscriptions" },
  ];
}

function assetItems(counts: NavCounts): NavItem[] {
  return [
    { href: "/accounts", label: "Accounts", meta: String(counts.accounts) },
    { href: "/investments", label: "Investments" },
    { href: "/fire", label: "FIRE calculator" },
    { href: "/cards", label: "Credit cards", meta: String(counts.creditCards) },
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
      <span>{item.label}</span>
      {item.meta && item.meta !== "0" && (
        <span className="font-mono text-[12.5px] leading-none text-text-3">{item.meta}</span>
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
          <button onClick={onClose} aria-label="Close menu" className="w-7 h-7 flex items-center justify-center text-text-3 hover:text-text">
            <X size={18} strokeWidth={1.75} />
          </button>
        )}
      </div>

      <div className="flex flex-col gap-[2px]">
        <div className="text-xs font-medium uppercase tracking-[0.06em] text-text-3 px-2 pb-2">Money</div>
        {moneyItems(counts).map((item) => (
          <NavRow key={item.href} item={item} active={isActive(item.href)} />
        ))}
      </div>

      <div className="flex flex-col gap-[2px]">
        <div className="text-xs font-medium uppercase tracking-[0.06em] text-text-3 px-2 pb-2">Assets</div>
        {assetItems(counts).map((item) => (
          <NavRow key={item.href} item={item} active={isActive(item.href)} />
        ))}
      </div>

      <div className="mt-auto flex flex-col gap-3">
        <div className="h-px bg-border" />

        <div className="flex items-center justify-between px-2">
          <span className="text-[13.5px] text-text-2">Hide amounts</span>
          <PrivacyToggle />
        </div>

        <div className="flex items-center justify-between px-2">
          <span className="text-[13.5px] text-text-2">Theme</span>
          <ThemeToggle />
        </div>

        {mockMode && (
          <span className="self-start inline-flex items-center gap-1.5 rounded-full bg-warning-subtle text-warning text-xs font-medium px-2.5 py-0.5">
            Mock data
          </span>
        )}

        <div
          className={cn(
            "flex items-center gap-2 px-2 py-2 -mx-2 rounded-control hover:bg-sunken",
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
          <SignOutButton />
        </div>
      </div>
    </nav>
  );
}
