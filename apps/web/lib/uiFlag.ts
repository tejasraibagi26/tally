/**
 * The look: Tally Pop is the default (web v2.2.0); the classic look is an
 * opt-out, chosen with the "New look" switch (components/UiToggle.tsx) in
 * the side nav. UI_PREF_COOKIE holds a browser's choice; only "classic"
 * changes anything. The account copy (users.ui_look, lib/uiLook.ts) is
 * what emails and the mobile app read; the switch writes both.
 *
 * Not httpOnly: the root layout's init script reads it before first paint,
 * the same way it reads the theme from localStorage, so pages stay static.
 */
export const UI_PREF_COOKIE = "tally-ui";
export const UI_POP = "pop";
export const UI_CLASSIC = "classic";
/**
 * The old preview flag cookie, set by /labs/pop before Pop was the default.
 * Only cleared now (app/labs/pop/route.ts ?off).
 */
export const UI_FLAG_COOKIE = "tally-ff-pop";

const YEAR = 60 * 60 * 24 * 365;

function readCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]!) : null;
}

export function isPopOn(): boolean {
  return readCookie(UI_PREF_COOKIE) !== UI_CLASSIC;
}

export function applyUi(pop: boolean) {
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${UI_PREF_COOKIE}=${pop ? UI_POP : UI_CLASSIC}; Path=/; Max-Age=${YEAR}; SameSite=Lax${secure}`;
  if (pop) document.documentElement.setAttribute("data-ui", UI_POP);
  else document.documentElement.removeAttribute("data-ui");
  applyFavicon(pop);
}

/** The classic tab icon (public/icon-classic.svg); app/icon.svg is Pop's. */
export const CLASSIC_ICON = "/icon-classic.svg";

export function applyFavicon(pop: boolean) {
  document.querySelectorAll<HTMLLinkElement>('link[rel~="icon"]').forEach((link) => {
    if (!link.dataset.popHref) link.dataset.popHref = link.href;
    link.href = pop ? link.dataset.popHref : CLASSIC_ICON;
  });
}
