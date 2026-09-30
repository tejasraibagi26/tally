/** @type {import('tailwindcss').Config} */
// Color/spacing/radius values are copied verbatim from DESIGN.md §5/§14 and
// MOBILE_DESIGN.md §3 — NativeWind can't read CSS custom properties at
// runtime the way web Tailwind does, so these are the literal hex source of
// truth for the mobile app. Keep in sync by hand with apps/web/app/globals.css.
const light = {
  canvas: "#F1F0EC",
  surface: "#FFFFFF",
  "surface-2": "#F8F8F5",
  sunken: "#ECEBE6",
  border: "#E3E1DB",
  "border-strong": "#8A877E",
  text: "#1A1917",
  "text-2": "#4D4B45",
  "text-3": "#65635C",
  brand: "#14513F",
  "brand-hover": "#0E3E30",
  "brand-subtle": "#D0E3D9",
  "brand-border": "#A9C8B9",
  "on-brand": "#FFFFFF",
  positive: "#237A3B",
  negative: "#B3372A",
  warning: "#835600",
  info: "#2466C6",
  "positive-subtle": "#E6F1E8",
  "negative-subtle": "#F8E8E5",
  "warning-subtle": "#F6EEDA",
  "info-subtle": "#E6EEFA",
  raised: "#FFFFFF",
  "raised-hover": "#F3F2EE",
  "status-good": "#0CA30C",
  "status-warning": "#FAB219",
  "status-serious": "#EC835A",
  "status-critical": "#D03B3B",
  "series-1": "#1baf7a",
  "series-2": "#eb6834",
  "series-3": "#2a78d6",
  "series-4": "#eda100",
  "series-5": "#e87ba4",
  "series-6": "#008300",
  "series-7": "#4a3aa7",
  "series-8": "#e34948",
};

// True OLED black, not a tinted near-black -- canvas/sunken are literal
// #000000, surface/surface-2 promoted to carry the elevation contrast.
// brand and positive sit 36° apart in hue (jade vs. grass) so a primary
// button and a gains figure never read as the same green. Keep in sync with
// apps/mobile/src/global.css's `.dark:root` block and apps/web/app/globals.css.
const dark = {
  canvas: "#0B0B0A",
  surface: "#191918",
  "surface-2": "#222220",
  sunken: "#111110",
  border: "#2C2C29",
  "border-strong": "#666560",
  text: "#EEEDE8",
  "text-2": "#B3B1A8",
  "text-3": "#908E85",
  brand: "#5BBFA3",
  "brand-hover": "#7ACFB6",
  "brand-subtle": "#11261F",
  "brand-border": "#24463B",
  "on-brand": "#0B1A15",
  positive: "#6CCB8E",
  negative: "#F48C75",
  warning: "#E8B45A",
  info: "#6AA5F0",
  "positive-subtle": "#13261A",
  "negative-subtle": "#2E1914",
  "warning-subtle": "#2C2312",
  "info-subtle": "#12203A",
  raised: "#292927",
  "raised-hover": "#33332F",
  "status-good": "#0CA30C",
  "status-warning": "#FAB219",
  "status-serious": "#EC835A",
  "status-critical": "#D03B3B",
  "series-1": "#23b07e",
  "series-2": "#e0662f",
  "series-3": "#4a93ea",
  "series-4": "#d69a1a",
  "series-5": "#dd6a93",
  "series-6": "#3aa95a",
  "series-7": "#9a90ee",
  "series-8": "#ea7575",
};

// Tokens that actually differ between light/dark (everything in
// global.css's :root / .dark:root blocks) resolve through a CSS variable, so
// a plain `bg-canvas` className -- with no `dark:` prefix needed -- already
// follows the system/app color scheme. status-*/series-* are intentionally
// left as static light-map hex: DESIGN.md fixes status colors across both
// themes, and series colors are never consumed via className (only via
// theme/colors.ts's raw chartSeries hex arrays), so they don't need a
// scheme-reactive class binding at all.
const CSS_VAR_TOKENS = [
  "canvas", "surface", "surface-2", "sunken", "border", "border-strong",
  "text", "text-2", "text-3", "brand", "brand-hover", "brand-subtle",
  "brand-border", "on-brand", "positive", "negative", "warning", "info",
  "positive-subtle", "negative-subtle", "warning-subtle", "info-subtle",
  "raised", "raised-hover",
];
const themeColors = { ...light };
for (const token of CSS_VAR_TOKENS) {
  themeColors[token] = `var(--color-${token})`;
}

module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  darkMode: "class",
  theme: {
    extend: {
      colors: themeColors,
      // Each weight is a separate registered font file (see theme/fonts.ts's
      // useFonts call), not a single family RN can weight-match at render
      // time -- so "font-ui" + Tailwind's "font-semibold" utility would
      // silently render the Regular file with a synthetic/system fake-bold
      // instead of the real SemiBold file. Use the weight-specific token
      // (font-ui-medium, font-ui-semibold) instead of stacking font-ui with
      // font-medium/font-semibold/font-bold.
      fontFamily: {
        ui: ["Inter"],
        "ui-medium": ["Inter_Medium"],
        "ui-semibold": ["Inter_SemiBold"],
        display: ["InstrumentSerif"],
        mono: ["JetBrainsMono"],
        "mono-medium": ["JetBrainsMono_Medium"],
      },
      // MOBILE_DESIGN.md §3.4: larger radii than web (softer, Wealthsimple-
      // inspired texture) -- 16 controls, 18 cards, 999 pills.
      borderRadius: {
        control: "16px",
        card: "18px",
        panel: "20px",
      },
    },
  },
  plugins: [],
  // Dark-mode palette swap. Exported for theme/colors.ts to import directly
  // (NativeWind's `dark:` variant handles class-based swaps in JSX; code that
  // needs a raw hex value -- chart series, SVG icons -- imports `dark` from
  // theme/colors.ts instead, which re-exports these same two objects).
  darkColors: dark,
  lightColors: light,
};
