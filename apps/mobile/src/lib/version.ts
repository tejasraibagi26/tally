import Constants from "expo-constants";

/**
 * The app's displayed build version, shown at the bottom of the More sheet
 * (more.tsx) -- the mobile equivalent of web's SideNav profile-footer
 * (apps/web/lib/version.ts), which this mirrors in policy but not in value:
 * mobile ships independently (EAS updates / app store), on its own cadence,
 * so it tracks its own counter rather than reusing web's.
 *
 * Bump this by hand on every user-visible change, right alongside the
 * change itself: a new feature or a meaningful behavior change bumps minor
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
 * callbacks rather than a third-party library's partial wiring.
 */
export const APP_VERSION = "1.4.4";

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
