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
 * fixes and the icon-tooltip sweep (patches). 1.5.3 was this footer's own
 * display fix -- centered layout, "build vX.Y.Z (N)" format, a tooltip that
 * actually shows on hover. 1.5.4 is a follow-up typography pass on that same
 * footer (monospace, muted "Build" label, a top border separating it from
 * the profile row) plus a real button style for the Transactions filter
 * bar's "Clear" (was a bare text link with no visual relation to the rest
 * of the bar's bordered controls). 1.5.5 closes out the icon-tooltip sweep
 * -- the recap-email switch on Settings was the one remaining control with
 * neither a visible label nor a title/aria-label. 1.5.6 swaps the plain
 * incrementing BUILD_NUMBER below for a real build SHA (see BUILD_SHA).
 * 1.5.7 fixes holdings priced at their market quote being stored in the
 * wrong currency (VFV, a CAD ETF, labeled USD and converted twice) -- the
 * currency now comes from the security's listing exchange. 1.5.8 makes
 * that hold on future syncs too: a price counts as the market quote within
 * a relative band (not to the cent), and a missing exchange is logged.
 * 1.5.9 assumes CAD (not USD) wherever a synced amount has no currency.
 * 1.5.10 narrows "hide amounts" to net worth, income, investment totals
 * and account balances -- spend, transactions, budgets etc. stay visible.
 * 1.6.0 swaps Overview's Cash flow tile for an Investments total. 1.6.1
 * keeps hidden-amount dots flush right in right-aligned columns. 1.7.0
 * adds a temporary "Refined dark mode (preview)" toggle in Settings to
 * trial the dark v2 palette side by side before it replaces the current one.
 * 1.7.1 wires --raised/--raised-hover into menus, dropdowns, popovers,
 * modals, side sheets and chart tooltips. 1.8.0 gives every budget its own
 * chart color and makes Overview's net worth chart full-bleed. 1.9.0 lets
 * "Spread across months" split a prepaid plan across 3, 6, 9 or 12 months.
 */
export const APP_VERSION = "1.9.0";

/**
 * A short (7-char) git commit SHA identifying the exact commit this build
 * was compiled from -- resolved once at build time in next.config.ts
 * (VERCEL_GIT_COMMIT_SHA on Vercel, `git rev-parse` locally) and inlined
 * into the client bundle via NEXT_PUBLIC_BUILD_SHA. Unlike a hand-maintained
 * counter, this can't drift out of sync with what's actually deployed --
 * there's nothing to remember to bump. "dev" is only ever seen if both the
 * env var and a local git checkout are unavailable (e.g. building from a
 * source tarball with no .git directory).
 */
export const BUILD_SHA = process.env.NEXT_PUBLIC_BUILD_SHA ?? "dev";
