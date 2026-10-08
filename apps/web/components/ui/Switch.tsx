"use client";

import { cn } from "@/lib/cn";

/** On/off switch (role="switch") for settings rows. */
export function Switch({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative h-6 w-11 flex-none rounded-full transition-colors disabled:opacity-60",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-info",
        checked ? "bg-brand" : "bg-border-strong",
      )}
    >
      <span className={cn("absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform motion-reduce:transition-none", checked && "translate-x-5")} />
    </button>
  );
}
