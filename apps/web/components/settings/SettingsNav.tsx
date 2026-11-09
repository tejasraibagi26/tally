"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/cn";
import { APP_VERSION } from "@/lib/version";
import { SETTINGS_SECTIONS, legacySettingsHashTarget } from "@/components/settings/sections";

/**
 * The Settings section menu: a column beside the content on wide screens, a
 * scrolling row of pills above it on narrow ones. Active by exact path, so
 * Account (/settings) doesn't light up on every section.
 */
export function SettingsNav() {
  const pathname = usePathname();
  const router = useRouter();

  // Old one-page links (/settings#alerts in alert emails already sent) land
  // on Account; forward them to the section that now holds the anchor.
  useEffect(() => {
    if (pathname !== "/settings") return;
    const target = legacySettingsHashTarget(window.location.hash);
    if (target) router.replace(target);
  }, [pathname, router]);

  return (
    <nav aria-label="Settings sections" className="lg:w-60 flex-none flex flex-col gap-4 lg:sticky lg:top-6">
      <ul className="m-0 p-0 list-none flex lg:flex-col gap-1.5 lg:gap-1 overflow-x-auto -mx-1 px-1 pb-1 lg:pb-0">
        {SETTINGS_SECTIONS.map((s) => {
          const active = pathname === s.href;
          return (
            <li key={s.href} className="flex-none">
              <Link
                href={s.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex flex-col rounded-full lg:rounded-control border px-3.5 py-1.5 lg:py-2.5 whitespace-nowrap transition-colors",
                  active ? "bg-brand-subtle border-[var(--brand-border)] text-text" : "border-border lg:border-transparent text-text-2 hover:text-text hover:bg-sunken",
                )}
              >
                <span className="text-[14px] font-semibold">{s.label}</span>
                <span className="hidden lg:block text-[12.5px] text-text-3">{s.hint}</span>
              </Link>
            </li>
          );
        })}
      </ul>
      <Link href="/settings/changelog" className="hidden lg:block px-3.5 font-mono text-[12px] text-text-3 hover:text-text-2 transition-colors">
        v{APP_VERSION} · Changelog
      </Link>
    </nav>
  );
}
