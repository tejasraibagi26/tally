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
 * that sheet to its content instead of a fixed 60% of the screen. 1.11.2
 * recalibrates it on iOS, where the floating sheet was still ~20% too tall.
 * 1.12.0 adds Settings → Alerts (email on/off per alert, large purchase
 * threshold, recent alerts), matching web.
 * 1.13.0 matches web v1.16: every add flow opens in the shared FormSheet
 * (income schedules and API tokens move out of inline forms; Subscriptions
 * gains "Add a bill"), pushed screens put Add in the header, and tab
 * screens share TabHeader (context line; Transactions leads with period
 * spend). Also fixes FIRE "Save": rates were sent as strings and rejected,
 * and saved expenses/contribution were never loaded back.
 * 1.13.1 computes the Subscriptions monthly total with the same shared
 * function as web and the recap email (@tally/core/subscriptionMath), so
 * a cancelled-but-manually-dated bill counts the same everywhere, and
 * manually added bills (rent) are left out of the total.
 * 1.14.0 adds a cold-start loading screen (components/BootSplash.tsx): the
 * tally mark drawing itself stroke by stroke, held until Overview's first
 * data lands (max 6s) instead of opening on skeletons. The native splash
 * images are now blank so the mark isn't shown twice (needs a new build).
 * 1.14.1 stops Face ID re-prompting on the app switcher, Control Center or
 * a quick minimize: it's asked on launch, or after 5+ minutes in the
 * background. In between, a plain cover (PrivacyCover) hides balances from
 * the app switcher snapshot instead.
 * 1.15.0 replaces Android's stock tab bar with a custom floating one
 * (components/AndroidTabBar.tsx) matching the iOS pill: a brand-tinted
 * highlight springs between tabs; hidden with the keyboard and on
 * transaction detail. Tab screens pad for it via useTabBarBottomClearance.
 * 1.15.1 fixes that bar's tabs bunching up on the left: NativeWind's
 * Pressable wrapper drops a function `style`, so the flex:1 never applied.
 * 1.16.0 redesigns the Accounts tab around connection health
 * (lib/connectionState.ts): a net worth / assets / debts summary, a
 * "N banks need you" strip with a Fix sheet, cards sorted most urgent
 * first, and one notice per card whose copy and state-colored action
 * depend on why it's unhealthy (expired sign-in, access ending, bank down,
 * not syncing, importing). Broken cards collapse to a dimmed "as of"
 * total; only the reconnecting card's button spins; missing balances show
 * "—"; accounts with no bank are listed; sync-all reports via toast/banner.
 * 1.16.1 fixes the bank sheet's "Last synced" and "Accounts" values
 * rendering black: an explicit `color: undefined` style beat the class.
 * 1.16.2 colors the Accounts summary's Debts figure negative (red), like web.
 * 1.16.3 brings account rows to the redesign spec: "Credit card · ····9921"
 * captions (TFSA/RRSP-style acronyms uppercased), a minus sign on card and
 * loan balances so rows agree with the card total, "No balance from bank"
 * under a missing balance, no resting pencil (tap or long-press renames),
 * a "was “old name”" hint while renaming, and an Other accounts footer.
 * 1.16.4 sets the summary's three figures in one size so they line up.
 * 1.16.5 keeps a budget's bar in its own color when spending lands exactly
 * on the budget (100%) instead of turning it amber; amber is 80% to <100%.
 * The Accounts health contract (connectionState) now lives in @tally/core,
 * shared with web; lib/connectionState.ts just re-exports it.
 * 1.17.0 redesigns Investments to match web 1.18.0 (@tally/core/investments):
 * a value-over-time chart (components/charts/PortfolioChart.tsx, plain SVG
 * with a scrub gesture) with money-in under it and a range switch,
 * Invested/Growth, allocation by type/account, top holdings rolled up
 * across accounts with gain, an All holdings screen (investment-holdings)
 * with account filter and sort, a holding sheet, plain-language activity
 * with this year's income/contributions, stale-connection notices, skeleton
 * loading, and an empty state that opens Plaid Link.
 * 1.18.0 redesigns Budgets to match web 1.19.0 (@tally/core/budgetView):
 * left to spend with a per-day allowance, rows grouped by parent category
 * with a pace tick and projection note (components/budgets/BudgetRowItem),
 * a "Not budgeted" row, one-tap setup for an empty month, a past-month
 * report, and BudgetDetailSheet (6-month history, toggles, Remove + undo)
 * replacing edit-in-AddBudgetSheet. Also fixes "days left" using UTC.
 * 1.19.0 redesigns Transactions to match web 1.20.0
 * (@tally/core/transactionView): one card per day with that day's net,
 * rows with a review dot, one status mark, a tappable category chip and
 * swipe-left Category / Reviewed actions (TransactionListRow), a
 * "N to review" banner and "To review" filter, and a full-screen review
 * queue (transactions/review) with swipe right to confirm, left for
 * another category, and "Always use my pick for <merchant>".
 * 1.20.0 redesigns Early retirement to match web 1.21.0: answer-first
 * hero, FireChart (plain SVG: projection, target line, ±1% band, labeled
 * crossing, age axis), what-ifs, milestones, autosaving levers with
 * inflation and account choice, the "to retire at 55" target when out of
 * reach, and an empty state with "Start from $0". Replaces the
 * gifted-charts projection and the Save button.
 * 1.20.1 trims the empty band at the bottom of every bottom sheet on iOS:
 * Sheet.tsx added the full 34pt home-indicator inset on top of each
 * sheet's own trailing padding; iOS now adds only insets.bottom − 20.
 * 1.20.2 shows a fixed budget's "Fixed" as a chip instead of loose text.
 * 1.21.0 redesigns Overview (MOBILE_DESIGN.md §5.2): a "needs you" card
 * (only when a bank needs a tap) and a "N to review" row replace the
 * always-on connections strip; one "This month" card (spent vs budget with
 * a pace tick, income, saved) and one Investments / Credit used card
 * replace the KPI grid; Budget this month shows the three most-used
 * budgets; Upcoming gets date tiles and due labels; Recent activity rows
 * match the Transactions list; Where it went moves last; the net worth
 * hero quiets its cents and gains a delta chip and a 1M / 3M / 6M / 1Y
 * range (@tally/core/overviewView). Reads a new this-month `unreviewed`
 * count from /api/analytics/overview, treated as zero from older servers.
 * 1.21.1 makes Overview's Credit used show the balance and limit behind
 * its percentage and note any card left out for having no limit, and
 * fixes the figure itself (web's /api/liabilities, shared with the web
 * Overview): overpaid cards count as zero used instead of offsetting other
 * cards, and each card's balance and limit are converted to one currency
 * before they're summed.
 */
export const APP_VERSION = "1.21.1";

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
