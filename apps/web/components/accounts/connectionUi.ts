import type { ConnectionTone } from "@tally/core/connectionState";

// Static class strings per tone so Tailwind's scanner sees every one --
// a template like `bg-${tone}` would be purged.

export const toneText: Record<ConnectionTone, string> = {
  positive: "text-positive",
  warning: "text-warning",
  negative: "text-negative",
  info: "text-info",
  brand: "text-brand",
  neutral: "text-text-3",
};

export const toneDot: Record<ConnectionTone, string> = {
  positive: "bg-positive",
  warning: "bg-warning",
  negative: "bg-negative",
  info: "bg-info",
  brand: "bg-brand",
  neutral: "bg-text-3",
};

export const toneSubtle: Record<ConnectionTone, string> = {
  positive: "bg-positive-subtle",
  warning: "bg-warning-subtle",
  negative: "bg-negative-subtle",
  info: "bg-info-subtle",
  brand: "bg-brand-subtle",
  neutral: "bg-sunken",
};

/** A state's action button is always drawn in that state's own color, never brand green. */
export const toneButton: Record<ConnectionTone, string> = {
  positive: "bg-positive text-on-brand",
  warning: "bg-warning text-on-brand",
  negative: "bg-negative text-on-brand",
  info: "bg-info text-on-brand",
  brand: "bg-brand text-on-brand",
  neutral: "bg-raised text-text border border-border",
};

const toneVar: Record<ConnectionTone, string> = {
  positive: "--positive",
  warning: "--warning",
  negative: "--negative",
  info: "--info",
  brand: "--brand",
  neutral: "--border-strong",
};

/** Tokens are CSS variables (no Tailwind alpha modifier), so tinted borders mix in CSS. */
export function toneBorder(tone: ConnectionTone, percent = 35): string {
  return `color-mix(in srgb, var(${toneVar[tone]}) ${percent}%, transparent)`;
}

export function initials(name: string | null): string {
  return (name ?? "?").replace(/[^A-Za-z0-9 ]/g, "").slice(0, 2).toUpperCase() || "?";
}

export function exactTime(iso: string): string {
  const d = new Date(iso);
  const time = d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  if (d.toDateString() === new Date().toDateString()) return `Today, ${time}`;
  return `${d.toLocaleDateString(undefined, { month: "short", day: "numeric" })}, ${time}`;
}
