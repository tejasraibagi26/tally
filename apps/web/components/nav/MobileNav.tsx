"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { LogoMark } from "@/components/Logo";
import { SideNav } from "@/components/nav/SideNav";

interface NavCounts {
  transactions: number;
  accounts: number;
  creditCards: number;
}

/** Below `lg` (1024px) the fixed sidebar (components/nav/SideNav.tsx) is hidden in favor of this: a
 * slim top bar plus a slide-in drawer holding the same nav content. Desktop is unaffected. */
export function MobileNav({
  user,
  counts,
  mockMode,
}: {
  user: { name: string | null; email: string };
  counts: NavCounts;
  mockMode: boolean;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <>
      <header className="lg:hidden flex-none flex items-center justify-between h-14 px-4 border-b border-border bg-surface">
        <div className="flex items-center gap-2">
          <LogoMark size={20} />
          <span className="font-display text-xl leading-none text-text">Tally</span>
        </div>
        <button
          onClick={() => setOpen(true)}
          aria-label="Open menu"
          className="w-9 h-9 -mr-1.5 flex items-center justify-center rounded-control text-text-2 hover:bg-sunken"
        >
          <Menu size={20} strokeWidth={1.75} />
        </button>
      </header>

      {open && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div
            className="absolute inset-0 motion-reduce:transition-none transition-opacity"
            style={{ backgroundColor: "color-mix(in srgb, var(--canvas) 60%, transparent)" }}
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <div className="relative w-60 max-w-[80%] h-full shadow-overlay animate-[slide-in-left_220ms_cubic-bezier(.32,.72,0,1)] motion-reduce:animate-none">
            <SideNav user={user} counts={counts} mockMode={mockMode} onClose={() => setOpen(false)} />
          </div>
        </div>
      )}
    </>
  );
}
