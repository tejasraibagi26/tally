/**
 * The app's displayed version (shown in SideNav's footer, under the profile
 * row) — not tied to package.json's version, which is a workspace/build
 * concern, not a "what did the user's app just change" one.
 *
 * Bump this by hand on every user-visible change, right alongside the
 * change itself: a new feature or a meaningful behavior change bumps minor
 * (1.4.0 → 1.5.0), a bug fix, small tweak, or polish-only change bumps
 * patch (1.5.0 → 1.5.1). Starting point (1.5.2) reflects the run of work
 * already shipped before this counter existed: institution totals + a
 * transactions sync button on mobile (minor), the transactions filter bar
 * rebuild -- instant search, month/range date picking, multi-select
 * accounts (two more minors), then the View-transactions/Clear-button bug
 * fixes and the icon-tooltip sweep (patches).
 */
export const APP_VERSION = "1.5.2";
