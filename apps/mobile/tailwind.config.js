/** @type {import('tailwindcss').Config} */
// Color/spacing/radius values are copied verbatim from DESIGN.md §5/§14 and
// MOBILE_DESIGN.md §3 — NativeWind can't read CSS custom properties at
// runtime the way web Tailwind does, so these are the literal hex source of
// truth for the mobile app. Keep in sync by hand with apps/web/app/globals.css.
const light = {
  canvas: "#F5F4F0",
  surface: "#FCFCFB",
  "surface-2": "#F9F8F5",
  sunken: "#EFEDE8",
  border: "#E4E1D9",
  "border-strong": "#938C7D",
  text: "#1A1917",
  "text-2": "#524F47",
  "text-3": "#6A665E",
  brand: "#14513F",
  "brand-hover": "#0E3E30",
  "brand-subtle": "#E6EFEA",
  "brand-border": "#BFD6CB",
  "on-brand": "#FFFFFF",
  positive: "#0F7A57",
  negative: "#B23A2C",
  warning: "#8A5A00",
  info: "#2A78D6",
  "positive-subtle": "#E3F0EA",
  "negative-subtle": "#F6E7E4",
  "warning-subtle": "#F5EEDC",
  "info-subtle": "#E5EEFA",
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
  canvas: "#000000",
  surface: "#151918",
  "surface-2": "#242928",
  sunken: "#000000",
  border: "#2F3736",
  "border-strong": "#566160",
  text: "#F5F5F4",
  "text-2": "#B2B6AF",
  "text-3": "#868B84",
  brand: "#53C6AF",
  "brand-hover": "#70D7C2",
  "brand-subtle": "#0F2420",
  "brand-border": "#244740",
  "on-brand": "#081614",
  positive: "#55CE6D",
  negative: "#F37B68",
  warning: "#E4A944",
  info: "#4791EB",
  "positive-subtle": "#112214",
  "negative-subtle": "#29130F",
  "warning-subtle": "#271F11",
  "info-subtle": "#101B28",
  "status-good": "#0CA30C",
  "status-warning": "#FAB219",
  "status-serious": "#EC835A",
  "status-critical": "#D03B3B",
  "series-1": "#199e70",
  "series-2": "#d95926",
  "series-3": "#3987e5",
  "series-4": "#c98500",
  "series-5": "#d55181",
  "series-6": "#008300",
  "series-7": "#9085e9",
  "series-8": "#e66767",
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
