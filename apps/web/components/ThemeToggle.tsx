"use client";

import { useEffect, useState } from "react";
import { Sun, Moon } from "lucide-react";
import { applyTheme, getStoredTheme, type Theme } from "@/lib/theme";
import { cn } from "@/lib/cn";

/** `variant="row"` is the SideNav footer form: a full-width nav-style "Appearance" row showing the current theme; clicking flips it. */
export function ThemeToggle({ variant = "switch" }: { variant?: "switch" | "row" }) {
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

  if (variant === "row") {
    return (
      <button
        onClick={toggle}
        aria-label={isDark ? "Appearance: dark. Switch to light" : "Appearance: light. Switch to dark"}
        className="w-full flex items-center justify-between gap-2.5 px-2.5 py-2 rounded-control text-[15px] text-text-2 hover:bg-sunken hover:text-text transition-colors"
      >
        <span className="flex items-center gap-2.5">
          {isDark ? <Moon size={17} strokeWidth={1.75} /> : <Sun size={17} strokeWidth={1.75} />}
          Appearance
        </span>
        <span className="text-[12.5px] text-text-3">{isDark ? "Dark" : "Light"}</span>
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
