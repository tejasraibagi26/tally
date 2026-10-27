import { vars } from "nativewind";
import { darkColors, lightColors } from "@/theme/colors";

/**
 * The Tally Pop palette (apps/web/app/globals.css's html[data-ui="pop"]
 * block, DESIGN.md §1a): grape brand, marigold highlight, ink outlines,
 * cream canvas. Every text pair is AA in both schemes. status-* and
 * series-* stay as they are -- the series order is the validated chart
 * palette. Keep in sync with web by hand, like the classic maps.
 */
export const popLightColors: Record<string, string> = {
  ...lightColors,
  canvas: "#FFF6E9",
  surface: "#FFFFFF",
  "surface-2": "#FFF1DC",
  sunken: "#F8EDDB",
  border: "#EADBC4",
  "border-strong": "#6B6880",
  text: "#1D1B2F",
  "text-2": "#4A4760",
  "text-3": "#625F78",
  brand: "#5B3BF5",
  "brand-hover": "#4527D9",
  "brand-subtle": "#E6E0FF",
  "brand-border": "#B9ABFF",
  "on-brand": "#FFFFFF",
  positive: "#0F7A43",
  negative: "#C2341F",
  warning: "#835600",
  info: "#2466C6",
  "positive-subtle": "#EBF7F0",
  "negative-subtle": "#FBE6E2",
  "warning-subtle": "#FFF0CC",
  "info-subtle": "#E6EEFA",
  raised: "#FFFFFF",
  "raised-hover": "#FFF1DC",
  // Pop-only: the sticker outline, its hard shadow, the highlight, and the
  // solid net-worth card with the text that sits on it.
  ink: "#1D1B2F",
  "ink-shadow": "#1D1B2F",
  marigold: "#FFC53D",
  "on-marigold": "#1D1B2F",
  "marigold-accent": "#5B3BF5",
  // The loader tile (the mark writing itself), AA-checked for non-text.
  "loader-bg": "#5B3BF5",
  "loader-ink": "#FFFFFF",
  "loader-accent": "#FFC53D",
  "hero-bg": "#5B3BF5",
  "hero-text": "#FFFFFF",
  "hero-text-2": "#E6E0FF",
  "hero-positive": "#C8F7DC",
  "hero-negative": "#FFD9D0",
};

export const popDarkColors: Record<string, string> = {
  ...darkColors,
  canvas: "#14121F",
  surface: "#1E1B2E",
  "surface-2": "#282440",
  sunken: "#110F1B",
  border: "#2E2A45",
  "border-strong": "#6E6895",
  text: "#F6F1E7",
  "text-2": "#B9B4CF",
  "text-3": "#9893B2",
  brand: "#9B87FF",
  "brand-hover": "#B7A8FF",
  "brand-subtle": "#2A2150",
  "brand-border": "#4B3F8A",
  "on-brand": "#14121F",
  positive: "#4FD69C",
  negative: "#FF8A73",
  warning: "#E8B45A",
  info: "#6AA5F0",
  "positive-subtle": "#123227",
  "negative-subtle": "#3A1E22",
  "warning-subtle": "#33290F",
  "info-subtle": "#172544",
  raised: "#282440",
  "raised-hover": "#2D2847",
  ink: "#6E6895",
  "ink-shadow": "#000000",
  marigold: "#FFCF5C",
  "on-marigold": "#14121F",
  "marigold-accent": "#3B2A9E",
  "loader-bg": "#2A2150",
  "loader-ink": "#9B87FF",
  "loader-accent": "#FFCF5C",
  "hero-bg": "#9B87FF",
  "hero-text": "#14121F",
  "hero-text-2": "#2A2150",
  "hero-positive": "#05301A",
  "hero-negative": "#5C1409",
};

// The color tokens global.css declares as CSS variables (the same list as
// tailwind.config.js's CSS_VAR_TOKENS).
const VAR_TOKENS = [
  "canvas", "surface", "surface-2", "sunken", "border", "border-strong",
  "text", "text-2", "text-3", "brand", "brand-hover", "brand-subtle",
  "brand-border", "on-brand", "positive", "negative", "warning", "info",
  "positive-subtle", "negative-subtle", "warning-subtle", "info-subtle",
  "raised", "raised-hover",
];

/** Registered font names for each family token (theme/fonts.ts). */
export const POP_FONTS = {
  ui: "Figtree",
  "ui-medium": "Figtree_SemiBold",
  "ui-semibold": "Figtree_Bold",
  display: "BricolageGrotesque_ExtraBold",
} as const;

export const CLASSIC_FONTS = {
  ui: "Inter",
  "ui-medium": "Inter_Medium",
  "ui-semibold": "Inter_SemiBold",
  display: "InstrumentSerif",
} as const;

function buildVars(colors: Record<string, string>) {
  const out: Record<string, string> = {};
  for (const token of VAR_TOKENS) out[`--color-${token}`] = colors[token]!;
  for (const [token, family] of Object.entries(POP_FONTS)) out[`--font-${token}`] = family;
  out["--radius-control"] = "14px";
  out["--radius-card"] = "22px";
  out["--radius-panel"] = "28px";
  out["--color-ink"] = colors.ink!;
  out["--border-button"] = "2px";
  out["--border-card"] = "2px";
  // Text fields: an outline so a field never melts into a dialog or sheet
  // of the same fill (dark Pop's raised and surface-2 match).
  out["--border-field"] = "1.5px";
  return out;
}

/**
 * NativeWind CSS variables that turn a subtree into Tally Pop: colors, the
 * font families behind font-ui / font-display, and the radii. Applied once
 * at the root (_layout.tsx), so every className follows without per-screen
 * changes.
 */
export const popVars = {
  light: vars(buildVars(popLightColors)),
  dark: vars(buildVars(popDarkColors)),
};
