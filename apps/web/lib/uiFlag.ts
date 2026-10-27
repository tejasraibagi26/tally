/**
 * The "Tally Pop" UI preview flag. A per-browser cookie, not a per-user
 * setting: it only restyles the web app (globals.css, under
 * html[data-ui="pop"]), so there's nothing to store server-side. Turned on
 * and off only by visiting /labs/pop (app/labs/pop/route.ts) -- nothing in
 * the app links to it.
 *
 * Not httpOnly: the root layout's init script reads it before first paint,
 * the same way it reads the theme from localStorage, so pages stay static.
 */
export const UI_FLAG_COOKIE = "tally-ui";
export const UI_FLAG_POP = "pop";
