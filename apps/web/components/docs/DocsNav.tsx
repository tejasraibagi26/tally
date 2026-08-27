"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";

export interface DocsNavItem {
  id: string;
  label: string;
  children?: DocsNavItem[];
}

function flattenIds(items: readonly DocsNavItem[]): string[] {
  return items.flatMap((item) => [item.id, ...(item.children ? flattenIds(item.children) : [])]);
}

/** Scroll-spy sidebar: highlights whichever section or subsection is currently nearest the top of the viewport. */
export function DocsNav({ items }: { items: readonly DocsNavItem[] }) {
  const [activeId, setActiveId] = useState(items[0]?.id ?? "");

  useEffect(() => {
    const ids = flattenIds(items);
    const sections = ids.map((id) => document.getElementById(id)).filter((el): el is HTMLElement => el !== null);
    if (sections.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible.length > 0) setActiveId(visible[0]!.target.id);
      },
      // The top ~25% of the viewport counts as the "active" band, so a
      // section is marked current once it reaches that band rather than
      // only once it reaches the very top of the viewport.
      { rootMargin: "-96px 0px -70% 0px", threshold: 0 },
    );

    sections.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [items]);

  function renderLink(item: DocsNavItem, indent: boolean) {
    const isActive = item.id === activeId;
    return (
      <a
        key={item.id}
        href={`#${item.id}`}
        className={cn(
          "relative text-[13.5px] px-2 py-1.5 rounded-control transition-colors",
          indent && "pl-3",
          isActive ? "text-brand bg-brand-subtle font-medium" : "text-text-2 hover:text-text hover:bg-surface-2",
        )}
      >
        {isActive && <span className="absolute left-0 top-1.5 bottom-1.5 w-[2px] rounded-full bg-brand" />}
        {item.label}
      </a>
    );
  }

  return (
    <nav className="sticky top-16 flex flex-col gap-0.5">
      <span className="text-xs font-medium uppercase tracking-wide text-text-3 px-2 pb-2">On this page</span>
      {items.map((item) => (
        <div key={item.id} className="flex flex-col gap-0.5">
          {renderLink(item, false)}
          {item.children && (
            <div className="flex flex-col gap-0.5 ml-2 border-l border-border">{item.children.map((child) => renderLink(child, true))}</div>
          )}
        </div>
      ))}
    </nav>
  );
}
