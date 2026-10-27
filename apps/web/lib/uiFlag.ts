/**
 * The "Tally Pop" UI preview. Two per-browser cookies, not per-user
 * settings: Pop only restyles the web app (globals.css, under
 * html[data-ui="pop"]), so there's nothing to store server-side.
 *
 * - UI_FLAG_COOKIE is the feature flag. Only /labs/pop sets it
 *   (app/labs/pop/route.ts) and only /labs/pop?off clears it; nothing in
 *   the app links there. Without it there's no Pop and no toggle.
 * - UI_PREF_COOKIE is which look a flagged browser wants, flipped by the
 *   "New look" switch (components/UiToggle.tsx) that only flagged browsers
 *   see.
 *
 * Not httpOnly: the root layout's init script reads both before first
 * paint, the same way it reads the theme from localStorage, so pages stay
 * static.
 */
export const UI_FLAG_COOKIE = "tally-ff-pop";
export const UI_PREF_COOKIE = "tally-ui";
export const UI_POP = "pop";
export const UI_CLASSIC = "classic";

const YEAR = 60 * 60 * 24 * 365;

function readCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]!) : null;
}

export function hasPopFlag(): boolean {
  return readCookie(UI_FLAG_COOKIE) === "1";
}

export function isPopOn(): boolean {
  return hasPopFlag() && readCookie(UI_PREF_COOKIE) !== UI_CLASSIC;
}

export function applyUi(pop: boolean) {
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${UI_PREF_COOKIE}=${pop ? UI_POP : UI_CLASSIC}; Path=/; Max-Age=${YEAR}; SameSite=Lax${secure}`;
  if (pop) document.documentElement.setAttribute("data-ui", UI_POP);
  else document.documentElement.removeAttribute("data-ui");
}
