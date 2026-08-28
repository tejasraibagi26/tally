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

const dark = {
  canvas: "#111110",
  surface: "#1A1A19",
  "surface-2": "#232320",
  sunken: "#0C0C0B",
  border: "#2B2B28",
  "border-strong": "#3D3D38",
  text: "#F2F1ED",
  "text-2": "#A8A69D",
  "text-3": "#77756D",
  brand: "#4FB394",
  "brand-hover": "#6AC5A9",
  "brand-subtle": "#14251F",
  "brand-border": "#234438",
  "on-brand": "#0C1A15",
  positive: "#4FC49B",
  negative: "#F0846B",
  warning: "#E0A94A",
  info: "#3987E5",
  "positive-subtle": "#12271F",
  "negative-subtle": "#2B1A16",
  "warning-subtle": "#2A2213",
  "info-subtle": "#111F2E",
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

module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  darkMode: "class",
  theme: {
    extend: {
      colors: light,
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
