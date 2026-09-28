/**
 * The app's displayed version (shown in SideNav's footer, under the profile
 * row) — not tied to package.json's version, which is a workspace/build
 * concern, not a "what did the user's app just change" one.
 *
 * Bump this by hand on every user-visible change, right alongside the
 * change itself: a new feature or a meaningful behavior change bumps minor
 * (1.4.0 → 1.5.0), a bug fix, small tweak, or polish-only change bumps
 * patch (1.5.0 → 1.5.1). Initial value (1.5.2) reflected the run of work
 * already shipped before this counter existed: institution totals + a
 * transactions sync button on mobile (minor), the transactions filter bar
 * rebuild -- instant search, month/range date picking, multi-select
 * accounts (two more minors), then the View-transactions/Clear-button bug
 * fixes and the icon-tooltip sweep (patches). 1.5.3 is this footer's own
 * display fix -- centered layout, "build vX.Y.Z (N)" format, a tooltip that
 * actually shows on hover.
 */
export const APP_VERSION = "1.5.3";

/**
 * Bump by exactly 1 on every deploy, regardless of whether APP_VERSION's
 * minor or patch moved -- unlike semver, this is just "how many times has
 * this shipped," a finer-grained counter for telling two builds on the same
 * version apart. Seeded from this repo's commit count at the time this file
 * was added rather than starting over at 1, so it reads as a real build
 * count instead of implying the app just started existing.
 */
export const BUILD_NUMBER = 232;
