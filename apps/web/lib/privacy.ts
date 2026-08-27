export const PRIVACY_STORAGE_KEY = "tally-hide-amounts";

export function applyPrivacy(hidden: boolean) {
  document.documentElement.setAttribute("data-hide-amounts", String(hidden));
  window.localStorage.setItem(PRIVACY_STORAGE_KEY, String(hidden));
}

export function getStoredPrivacy(): boolean | null {
  if (typeof window === "undefined") return null;
  const stored = window.localStorage.getItem(PRIVACY_STORAGE_KEY);
  return stored === "true" || stored === "false" ? stored === "true" : null;
}
