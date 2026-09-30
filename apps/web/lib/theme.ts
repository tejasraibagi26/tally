export type Theme = "light" | "dark";
export const THEME_STORAGE_KEY = "tally-theme";

export function applyTheme(theme: Theme) {
  document.documentElement.setAttribute("data-theme", theme);
  window.localStorage.setItem(THEME_STORAGE_KEY, theme);
}

export function getStoredTheme(): Theme | null {
  if (typeof window === "undefined") return null;
  const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
  return stored === "light" || stored === "dark" ? stored : null;
}

// TEMPORARY -- "Refined dark mode (preview)", a side-by-side trial of the
// dark v2 palette (the [data-dark-v2="true"] block in app/globals.css)
// before it replaces the current dark tokens outright. Remove this, the
// layout init script, the CSS block's selector split and the Settings
// toggle together once v2 is committed.
export const DARK_V2_STORAGE_KEY = "tally-dark-v2";

export function applyDarkV2(enabled: boolean) {
  document.documentElement.setAttribute("data-dark-v2", String(enabled));
  window.localStorage.setItem(DARK_V2_STORAGE_KEY, String(enabled));
}

export function getStoredDarkV2(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(DARK_V2_STORAGE_KEY) === "true";
}
