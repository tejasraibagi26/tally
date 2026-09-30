"use client";

import { useEffect, useState } from "react";
import { Sun, Moon } from "lucide-react";
import { applyTheme, getStoredTheme, type Theme } from "@/lib/theme";
import { cn } from "@/lib/cn";

/** `variant="segment"` is one half of the SideNav footer's labeled pill (see SideNav); it names the current theme and flips it on click. */
export function ThemeToggle({ variant = "switch" }: { variant?: "switch" | "segment" }) {
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    const stored = getStoredTheme();
    const initial = stored ?? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    setTheme(initial);
    document.documentElement.setAttribute("data-theme", initial);
  }, []);

  function toggle() {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next);
    applyTheme(next);
  }

  const isDark = theme === "dark";

  if (variant === "segment") {
    return (
      <button
        onClick={toggle}
        role="switch"
        aria-checked={isDark}
        aria-label="Toggle color theme"
        title={isDark ? "Switch to light theme" : "Switch to dark theme"}
        className="flex-1 h-8 flex items-center justify-center gap-1.5 text-[12.5px] transition-colors text-text-2 hover:bg-sunken hover:text-text"
      >
        {isDark ? <Moon size={14} strokeWidth={1.9} /> : <Sun size={14} strokeWidth={1.9} />}
        {isDark ? "Dark" : "Light"}
      </button>
    );
  }

  return (
    <button
      onClick={toggle}
      role="switch"
      aria-checked={isDark}
      aria-label="Toggle color theme"
      title={isDark ? "Switch to light theme" : "Switch to dark theme"}
      className={cn(
        "relative inline-flex items-center flex-none w-[52px] h-7 rounded-full border border-border-strong transition-colors duration-300",
        isDark ? "bg-sunken" : "bg-surface-2",
      )}
    >
      <span
        className={cn(
          "absolute top-0.5 left-0.5 w-6 h-6 rounded-full bg-surface shadow-raised flex items-center justify-center transition-transform duration-300 ease-out",
          isDark && "translate-x-[24px]",
        )}
      >
        {isDark ? <Moon size={13} strokeWidth={2} className="text-text-2" /> : <Sun size={13} strokeWidth={2} className="text-warning" />}
      </span>
    </button>
  );
}
