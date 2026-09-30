import Constants from "expo-constants";

/**
 * The app's displayed build version, shown at the bottom of the More sheet
 * (more.tsx) -- the mobile equivalent of web's SideNav profile-footer
 * (apps/web/lib/version.ts), which this mirrors in policy but not in value:
 * mobile ships independently (EAS updates / app store), on its own cadence,
 * so it tracks its own counter rather than reusing web's.
 *
 * Bump this by hand on every user-visible change, right alongside the
 * change itself -- and add a matching user-facing entry to lib/changelog.ts: a new feature or a meaningful behavior change bumps minor
 * (1.3.0 → 1.4.0), a bug fix, small tweak, or polish-only change bumps
 * patch (1.4.0 → 1.4.1). Starting point (1.4.0) reflects the run of mobile
 * work already shipped this session before this counter existed:
 * institution totals on Accounts and a transactions sync button (two
 * minors), the button reorder (patch), search + the View-transactions
 * deep-link/Clear-all bug fixes on Transactions (minor + patch), and the
 * net worth chart's slide-to-scrub (minor). 1.4.1 is a fix to that same
 * scrub gesture -- the outer ScrollView now locks (scrollEnabled=false) the
 * instant a touch lands on the chart, so a mid-drag vertical wobble can no
 * longer hand the gesture to page scrolling instead of the chart. 1.4.2
 * fixes that fix: gifted-charts' pointerConfig.onTouchStart/onTouchEnd
 * turned out to only be wired on one of its two internal render paths, so
 * the reset on release wasn't firing reliably. The scroll-lock and the
 * hover reset now both come from the wrapping View's own onTouchStart/
 * onTouchEnd/onTouchCancel instead, which fire regardless of which
 * descendant ends up owning the touch responder. 1.4.3 swaps the plain
 * incrementing BUILD_NUMBER below for a real build SHA (see BUILD_SHA).
 * 1.4.4 replaces the touch-detection approach entirely, again: neither
 * gifted-charts' pointerConfig callbacks nor a wrapping View's raw touch
 * props turned out to reliably fire on release. A PanResponder now owns
 * the chart's gesture directly -- it computes the touched index itself
 * (no gifted-charts pointer system involved at all) and resets on
 * onPanResponderRelease/Terminate, core React Native touch-lifecycle
 * callbacks rather than a third-party library's partial wiring. 1.4.5
 * shows a "Syncing…" spinner in an institution card's subtitle while its
 * per-item "Refresh balances" is in flight -- previously the only spinner
 * lived in the actions sheet, which closes the moment the row is tapped.
 * 1.5.0 regroups the Budgets tab into one card: the summary becomes its
 * header (left to spend, a category-segmented total bar, progress caption)
 * and every budget is a hairline-divided row inside it. 1.5.1 narrows
 * "hide amounts" to net worth, income, investment totals and account
 * balances (matching web) -- now masks the income/cash-flow tiles and
 * income schedules, and unmasks FIRE's target and projection. 1.6.0 swaps
 * Overview's Cash flow tile for an Investments total. 1.6.1 paints
 * Android's pushed-screen toolbar canvas-colored with no shadow, so it
 * blends into the page instead of sitting on it as a white slab. 1.6.2
 * moves Investments' Sync into the header as plain text. 1.6.3 colors
 * each budget distinctly (server-assigned colorSlot) instead of sharing
 * its parent category's color. 1.7.0 adds 3/6/9/12-month terms to
 * "Spread across months" (transaction detail and Subscriptions). 1.7.1
 * makes Overview's net worth chart full-bleed and taller, like web's.
 * 1.8.0 adopts web's refined dark palette (near-black canvas instead of
 * OLED black, higher-contrast text and borders, raised sheets). 1.8.1 adds
 * a changelog screen, opened by tapping the build line in the More sheet.
 * 1.9.0 makes Android's tab bar translucent and floating, and drops the
 * circle behind Android's back button. 1.9.1 lightens that tab bar's tint
 * (85% → 60%) so it actually reads as see-through in dark mode. 1.9.2
 * reverts that bottom tab bar change (a misread request -- the ask was
 * the top bar) and makes the pushed screens' top bar transparent on
 * Android via a custom TransparentHeader. 1.10.0 adopts web's refined
 * light palette ("light v2", web v1.12.0). 1.10.1 deepens brand-subtle
 * so the green pill buttons (Sync, Add account, Filters) are visible on
 * the light canvas again. 1.11.0 regroups the More sheet to match web's
 * side nav: a "Your money" card (Subscriptions, Investments, Early
 * retirement) and an "Account" card (Settings, Sign out). 1.11.1 sizes
 * that sheet to its content instead of a fixed 60% of the screen.
 */
export const APP_VERSION = "1.11.1";

/**
 * A short (7-char) git commit SHA identifying the exact commit this build
 * was compiled from -- computed in app.config.js (EAS_BUILD_GIT_COMMIT_HASH
 * on an EAS Build/Update, `git rev-parse` locally), added to `extra`, and
 * read back here via expo-constants. Unlike a hand-maintained counter, this
 * can't drift out of sync with what's actually running -- there's nothing
 * to remember to bump. "dev" is only ever seen if both are unavailable
 * (e.g. a Metro bundle built from a source tree with no .git directory).
 */
export const BUILD_SHA: string = Constants.expoConfig?.extra?.buildSha ?? "dev";
