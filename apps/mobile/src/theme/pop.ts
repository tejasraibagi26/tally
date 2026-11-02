import { vars } from "nativewind";
import { darkColors, lightColors } from "@/theme/colors";

/**
 * The Tally Pop palette (apps/web/app/globals.css's html[data-ui="pop"]
 * block, DESIGN.md §1a): grape brand, marigold highlight, ink outlines,
 * cream canvas. Every text pair is AA in both schemes. status-* and
 * series-* stay as they are -- the series order is the validated chart
 * palette.
 *
 * Mobile v2.18.0 ("Pop Calm", mobile only -- web keeps the sticker look):
 * a neutral warm canvas instead of cream, no ink outlines or hard offset
 * shadows on cards and buttons, squarer radii. surface-2, raised and
 * raised-hover are deliberately unchanged: they tint the floating-glass
 * sheets (SHEET_WASH / SHEET_CARD), which keep their look. So these maps
 * no longer match web's html[data-ui="pop"] block for canvas, sunken,
 * border, text-3, the dark surface and the radii.
 */
export const popLightColors: Record<string, string> = {
  ...lightColors,
  canvas: "#F6F4F0",
  surface: "#FFFFFF",
  "surface-2": "#FFF1DC",
  sunken: "#F1ECE3",
  border: "#ECE6DC",
  "border-strong": "#6B6880",
  text: "#1D1B2F",
  "text-2": "#4A4760",
  "text-3": "#5F5C73",
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
  // Pop Calm (v2.18.1): text field outline, quieter than ink.
  "field-line": "#CFC7B9",
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
  canvas: "#0B0A10",
  surface: "#16141F",
  "surface-2": "#1C1A27",
  sunken: "#060509",
  border: "#22202D",
  "border-strong": "#6E6895",
  text: "#F6F1E7",
  "text-2": "#B9B4CF",
  "text-3": "#A19CB9",
  brand: "#9B87FF",
  "brand-hover": "#B7A8FF",
  "brand-subtle": "#1F1840",
  "brand-border": "#4B3F8A",
  "on-brand": "#0A0910",
  positive: "#4FD69C",
  negative: "#FF8A73",
  warning: "#E8B45A",
  info: "#6AA5F0",
  "positive-subtle": "#0C241B",
  "negative-subtle": "#2B1519",
  "warning-subtle": "#251E0A",
  "info-subtle": "#101B33",
  raised: "#1C1A27",
  "raised-hover": "#22202F",
  // Cream outline (as strong as light's ink) over a hard grape shadow: a
  // dark shadow vanishes on the #0A0910 canvas, a coloured one reads.
  ink: "#F6F1E7",
  "ink-shadow": "#6A4BFF",
  "field-line": "#4A4560",
  marigold: "#FFCF5C",
  "on-marigold": "#0A0910",
  "marigold-accent": "#3B2A9E",
  "loader-bg": "#1F1840",
  "loader-ink": "#9B87FF",
  "loader-accent": "#FFCF5C",
  // Light's solid grape hero; it sits on a marigold shadow (PopOverview).
  "hero-bg": "#5B3BF5",
  "hero-text": "#FFFFFF",
  "hero-text-2": "#E6E0FF",
  "hero-positive": "#C8F7DC",
  "hero-negative": "#FFD9D0",
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

function buildVars(colors: Record<string, string>) {
  const out: Record<string, string> = {};
  for (const token of VAR_TOKENS) out[`--color-${token}`] = colors[token]!;
  for (const [token, family] of Object.entries(POP_FONTS)) out[`--font-${token}`] = family;
  // Pop Calm (mobile v2.18.0): squarer corners -- 12 on cards, 8 on
  // controls. The panel radius stays: it shapes dialogs, and sheets keep
  // their floating-glass look unchanged.
  out["--radius-control"] = "8px";
  out["--radius-card"] = "12px";
  out["--radius-panel"] = "28px";
  out["--color-ink"] = colors.ink!;
  // Pop Calm: no ink outline on buttons or cards. Cards separate with a
  // soft shadow (light) or a hairline border (dark) -- see Card.tsx.
  out["--border-button"] = "0px";
  out["--border-card"] = "0px";
  // Text fields: an outline so a field never melts into a dialog or sheet
  // of the same fill (dark Pop's raised and surface-2 match).
  out["--border-field"] = "1px";
  out["--color-field-line"] = colors["field-line"]!;
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
