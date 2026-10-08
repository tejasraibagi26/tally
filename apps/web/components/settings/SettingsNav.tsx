"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/cn";

export interface SettingsNavItem {
  id: string;
  label: string;
  tone?: "negative";
}

/**
 * The sticky section menu beside Settings (1024px and up). Highlights the
 * section in view; links are plain #anchors, so deep links like the alert
 * emails' /settings#alerts keep working.
 */
export function SettingsNav({ items, version }: { items: SettingsNavItem[]; version: string }) {
  const [active, setActive] = useState(items[0]?.id);

  useEffect(() => {
    const sections = items.map((i) => document.getElementById(i.id)).filter((el): el is HTMLElement => el !== null);
    const visible = new Map<string, number>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) visible.set(e.target.id, e.isIntersecting ? e.intersectionRatio : 0);
        // The topmost section that's at least partly in the upper part of the view.
        const first = sections.find((s) => (visible.get(s.id) ?? 0) > 0);
        if (first) setActive(first.id);
      },
      // Only the top 40% of the viewport counts, so the highlight moves as a section reaches the top.
      { rootMargin: "0px 0px -60% 0px", threshold: [0, 0.01] },
    );
    sections.forEach((s) => observer.observe(s));
    return () => observer.disconnect();
  }, [items]);

  return (
    <nav aria-label="Settings sections" className="sticky top-7 flex flex-col gap-0.5 text-[14px]">
      {items.map((item) => (
        <a
          key={item.id}
          href={`#${item.id}`}
          aria-current={active === item.id ? "true" : undefined}
          className={cn(
            "px-2.5 py-1.5 rounded-control transition-colors",
            item.tone === "negative" && "mt-2",
            active === item.id
              ? "bg-brand-subtle text-brand font-medium"
              : item.tone === "negative"
                ? "text-negative hover:bg-negative-subtle"
                : "text-text-2 hover:text-text hover:bg-sunken",
          )}
        >
          {item.label}
        </a>
      ))}
      {/* The only way into the changelog -- kept deliberately quiet. */}
      <Link href="/settings/changelog" className="mt-5 px-2.5 font-mono text-[12px] text-text-3 hover:text-text-2 transition-colors">
        v{version} · Changelog
      </Link>
    </nav>
  );
}
