import type { Config } from "tailwindcss";

// Colors are read from the CSS custom properties defined in app/globals.css,
// which are the token block specified in DESIGN.md §14 — that file is the
// source of truth. Do not hand-pick hex values in components.
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  darkMode: ["class", '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        canvas: "var(--canvas)",
        surface: "var(--surface)",
        "surface-2": "var(--surface-2)",
        sunken: "var(--sunken)",
        border: "var(--border)",
        "border-strong": "var(--border-strong)",
        text: "var(--text)",
        "text-2": "var(--text-2)",
        "text-3": "var(--text-3)",
        brand: "var(--brand)",
        "brand-hover": "var(--brand-hover)",
        "brand-subtle": "var(--brand-subtle)",
        "brand-border": "var(--brand-border)",
        "on-brand": "var(--on-brand)",
        positive: "var(--positive)",
        negative: "var(--negative)",
        warning: "var(--warning)",
        info: "var(--info)",
        "positive-subtle": "var(--positive-subtle)",
        "negative-subtle": "var(--negative-subtle)",
        "warning-subtle": "var(--warning-subtle)",
        "info-subtle": "var(--info-subtle)",
        "status-good": "var(--status-good)",
        "status-warning": "var(--status-warning)",
        "status-serious": "var(--status-serious)",
        "status-critical": "var(--status-critical)",
        "series-1": "var(--series-1)",
        "series-2": "var(--series-2)",
        "series-3": "var(--series-3)",
        "series-4": "var(--series-4)",
        "series-5": "var(--series-5)",
        "series-6": "var(--series-6)",
        "series-7": "var(--series-7)",
        "series-8": "var(--series-8)",
      },
      fontFamily: {
        ui: ["var(--font-inter)", "ui-sans-serif", "system-ui", "sans-serif"],
        display: ["var(--font-instrument-serif)", "Georgia", "serif"],
        mono: ["var(--font-jetbrains-mono)", "ui-monospace", "monospace"],
      },
      borderRadius: {
        control: "var(--radius-control)",
        card: "var(--radius-card)",
        panel: "var(--radius-panel)",
      },
      boxShadow: {
        raised: "var(--shadow-raised)",
        overlay: "var(--shadow-overlay)",
      },
    },
  },
  plugins: [],
};

export default config;
