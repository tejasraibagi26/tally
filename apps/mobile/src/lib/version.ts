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
 * range (@tally/core/overviewView).
 * 1.21.1 makes Overview's Credit used show the balance and limit behind
 * its percentage and note any card left out for having no limit, and
 * fixes the figure itself (web's /api/liabilities, shared with the web
 * Overview): overpaid cards count as zero used instead of offsetting other
 * cards, and each card's balance and limit are converted to one currency
 * before they're summed.
 * 1.21.2 limits "N transactions to review" to this month: the count is the
 * Transactions tab's own this-month figure (it no longer needs a new
 * /api/analytics/overview field), and the review queue it opens asks for
 * `?scope=month`, so older months' backlog no longer shows anywhere.
 * 1.21.3 removes the "how far through the month" tick from the This month
 * bar, makes the Overview net worth figure larger (68pt), and draws the
 * "transactions to review" row as a solid brand bar.
 * 1.22.0 tightens Overview's Upcoming and lets you correct it: only money
 * going out is listed (a detected paycheck or bonus never is), a bill you
 * removed stays gone, guessed bills must clear a confidence bar, and dates
 * use your timezone (all server-side, @tally/core/overviewView's
 * qualifiesAsUpcoming). A bill Tally guessed opens a sheet with "This won't
 * recur", which dismisses the stream behind it.
 * 1.23.0 is Overview v2's app-only pass: "View all" opens a new Upcoming
 * screen (app/upcoming.tsx: Overdue / This week / Later, card payments
 * included); Credit used notes when a single card is at or over 30%
 * (highCardCount); "Saved so far" stays plain text when negative mid-month;
 * the chart marks today (and the scrubbed day) with a dot the chart draws
 * itself; the attention cards fade in and out; Needs you rows are one line
 * each with a compact pill.
 * 1.24.0 is Overview v2's server pass (needs web 1.22.0): a bill stays in
 * Upcoming for 3 days past due, first in the list and marked "Overdue · 2
 * days" (cards only when the bank flags them); a card with no reported
 * minimum shows "Min. unknown" plus its statement balance instead of $0.00;
 * "This won't recur" offers Undo for 5 seconds (useDismissUndo, the shared
 * components/ui/Toast now also used by Accounts), and Subscriptions lists
 * dismissed bills with Restore (GET /api/recurring?dismissed=1, PATCH
 * { dismissed: false }).
 * 1.24.1 always shows Upcoming's "View all" when there are bills; it only
 * appeared above three, which left the Upcoming screen unreachable for most.
 * 1.25.0 redesigns the transaction edit screen (transactions/[id].tsx) to
 * match web 1.23.0: category first with suggestions and the merchant rule,
 * "How it counts" (excluded, Split and Spread as their own views), note and
 * tags, folded Details. Each change saves on its own with an Undo toast;
 * the Save bar is gone, so the bottom keeps only the safe-area offset.
 * Tags, split editing and the merchant rule are new on mobile, and Delete
 * shows only on transactions you added (the server refuses the rest).
 * 1.25.1 fixes the Transactions header: a stray copy of the "To review"
 * chip had landed inside the Filters button, widening the action row until
 * the title read "Tran…". Filters is now a round icon button like + and
 * sync, with its count badge on the corner.
 * 1.25.2 draws the Transactions list as one continuous table with a header
 * band per day, instead of a separate card for each day.
 * 1.26.0 shows merchant logos (the API's new logoUrl) on transaction rows,
 * Overview's Recent activity and the edit screen, through
 * components/transactions/MerchantAvatar.tsx (React Native's Image, so no
 * new native module); the first letter stays as the fallback.
 * 1.26.1 puts logos on a white tile in both themes; dark marks on a
 * transparent background (Uber's wordmark) disappeared on the dark tile.
 * 1.27.0 adds Credit cards (app/cards.tsx, app/card/[id].tsx), reached from
 * More and Overview's Credit used: you owe, the next payment, one flat table
 * of cards with brand tiles (components/cards/CardTile.tsx), and a card
 * screen with its statement cycle, charges, APRs and a limit sheet. Rules
 * come from @tally/core/cardView via GET /api/liabilities. Upcoming card
 * rows say how much of a statement is paid. Transactions accepts an
 * ?account= link.
 * 1.27.1 grows the More sheet by one row (MORE_SHEET_CONTENT_HEIGHT 415 ->
 * 464) for Credit cards; Sign out sat on the home indicator and the build
 * line was cut off.
 * 1.27.2 moves the large card tile's last four digits to the top-right so
 * they no longer run into the network mark. (The AMEX badge stays on Amex
 * cards even next to Amex's own logo.)
 * 1.27.3 gives the navigators a React Navigation theme (app/_layout.tsx
 * ThemeProvider, built from the app's tokens, following the color scheme).
 * Without one the default light theme applied: its dark=false forced every
 * iOS header's userInterfaceStyle to light, so the Liquid Glass back button
 * and bar rendered light in Dark Mode, and the stack/tab containers were
 * painted the light theme's grey.
 * 2.0.0 brings Tally Pop to mobile behind the same flag as web: the app
 * reads users.ui_look from GET /api/account (lib/UiLookContext.tsx), shows a
 * "New look" switch in Settings to a flagged account, and restyles from the
 * root through NativeWind vars() (theme/pop.ts: colors, Figtree/Bricolage,
 * radii, ink outlines on cards and filled buttons). Overview gets the
 * greeting with what's left to spend, the net worth on a solid brand card,
 * the on-pace streak and "N to tally up"; Review counts in tally marks;
 * charts run edge to edge; the loader, boot splash and the home-screen icon
 * (expo-alternate-app-icons, needs a native build) follow the look.
 * 2.1.0 adds year-end goals, Tally Pop only: an Overview card, a Goals
 * screen (from the More sheet) with the projection and suggested cuts, a
 * line on Budgets, the goal alert in Alerts, and a one-time announcement
 * (GoalIntroDialog) -- all on GET/PUT/DELETE /api/goals and @tally/core/goalMath.
 * 2.1.1 blurs the screen behind every TallyDialog on iOS 26+ (a dark-tinted
 * expo-glass-effect GlassView), like web's modal backdrop-blur; Android and
 * older iOS keep the plain scrim.
 * 2.1.2 puts the goals announcement's "Set a goal" above "Not now", the
 * order the app's other stacked dialogs use.
 * 2.1.3 brings Pop's ink outline and sticker shadow to the hand-built
 * cards that missed it: Overview's "banks need you" card (and its fix
 * buttons), the Investments / Credit used pair, and the filtered-empty
 * Transactions note. useStickerShadow (ui/Card.tsx) shares the shadow.
 * 2.2.0: dialogs blur with expo-blur (UIBlurEffect, every iOS version; a
 * native module, so it needs a native build -- older builds fall back to
 * the glass layer, then the scrim, never crash). The year-end goal's
 * amounts follow "hide amounts" (usePrivateMoney), its card puts the
 * target under the big figure, and the Goals screen's chart matches web:
 * area, dashed projection, labelled target, dates, and press-and-drag to
 * read any point (components/charts/GoalChart.tsx; the page holds still
 * while scrubbing).
 * 2.2.1 turns Budgets' goal line into a one-line outlined row ("Year-end
 * goal · On track · $X to go" + chevron) instead of a wrapping sentence.
 * 2.2.2 leads the goal card with what's left, not net worth again under
 * Overview's net worth card; the Goals screen adds "now $Z".
 * 2.2.3 sets the budget sheet's spent/budget and the review card's amount
 * in Pop's display face.
 * 2.2.4 outlines text fields in Pop (border-field + border-ink, 0px in
 * classic): dark Pop's dialog/sheet fill and the field fill are the same
 * colour, so fields like Wipe's password disappeared.
 * 2.3.0 makes Tally Pop the default (lib/UiLookContext.tsx: Pop unless the
 * account chose classic; "New look" in Settings for everyone), and makes
 * Pop's icon and splash the app's own (app.json; the classic icon is the
 * "Classic" alternate) -- the icon and splash need a native build.
 * 2.3.1 announces the new look once per account on Overview
 * (components/overview/NewLookDialog.tsx, POST /api/announcements/seen),
 * ahead of the goals intro, which now waits for the next visit.
 * 2.3.2 outlines dialogs' secondary buttons in Pop's 2px ink (TallyDialog),
 * which in dark Pop were a hairline lost against the dialog.
 * 2.3.3 adds "How it works" to the Goals screen (GoalHowItWorksDialog),
 * sharing web's words via @tally/core/goalMath GOAL_HOW_IT_WORKS.
 * 2.3.4 centres every Switch in its row (alignSelf: "center"): iOS 26's
 * switch drew at the top of the row otherwise.
 * 2.3.5 stops the Goals screen's goal card linking to Goals (GoalCard
 * linked={false}): each tap stacked another copy of the screen.
 * 2.3.6 asks before every removal that didn't yet (a native Alert, like
 * AddBudgetSheet's): the goal (goals.tsx), a budget (BudgetDetailSheet), a
 * split (transactions/[id].tsx) and a manual card limit (card/[id].tsx).
 * 2.3.7 centres a dialog's title on its icon tile (TallyDialog), as web
 * 2.2.9 does.
 * 2.3.8 stops Pop's edge-to-edge charts at the card's ink outline
 * (Bleed cancelled the full padding and drew 2px over it), and sizes Where
 * it went's segments by flexGrow: percentage widths plus the gaps overflowed
 * and clipped the last one.
 * 2.3.9 drops the "Your money" label above Transactions' title (and
 * TabHeader's eyebrow prop, which only it used).
 * 2.3.10 shows "Always use … for transactions like …" on a transaction with
 * no merchant name (ruleTargetFor, as web 2.3.3 does); useRulePreview takes
 * the rule's match instead of a merchant name.
 * 2.4.0 adds safe to spend, Tally Pop only, as web 2.4.0 does: a card under
 * the net worth hero (components/overview/SafeToSpend.tsx, GET
 * /api/safe-to-spend) with a breakdown sheet, a compact on-pace row under
 * it, a Safe to spend settings screen (app/safe-to-spend.tsx: next
 * paycheque, accounts that count, cushion, card due days) linked from
 * Settings → Data, and the safe_to_spend_low alert with its amount in
 * Alerts. Pop's dark ink-shadow is the ink color (#6E6895), as on web
 * 2.4.2: black vanished on the dark canvas.
 * 2.4.1 matches web 2.4.4: the breakdown sheet's sum is a sticker card, and
 * its subtracted amounts are magnitudes (no "− Cushion −$50.00").
 * 2.4.2 shows "Next paycheque" on the Income screen, as web's Settings →
 * Income does (components/settings/NextPaychequeCard.tsx, shared with the
 * Safe to spend screen), and names that screen and its Settings row Income.
 * 2.4.3 gives that row the next paycheque's date ("Next Nov 14") instead of
 * a count of hand-made schedules, which read 0 beside a found paycheque.
 * 2.4.4 limits a card's due day to two digits on a number pad and says
 * what it's for, as web 2.4.5 does with a select.
 * 2.4.5 replaces that field with a day grid in a bottom sheet
 * (components/ui/DayOfMonthPicker.tsx), matching web 2.4.6.
 * 2.5.0 adds Year in review (app/year-in-review.tsx, GET
 * /api/year-in-review), web 2.5.0's sections in one column with a year
 * switcher, from a new More row (lib/moreSheet.ts grows 49pt).
 * 2.6.0 adds tags: app/tags.tsx lists them from More (another 49pt) and
 * app/tag/[tag].tsx adds one up (GET /api/tags, /api/tags/[tag]); a
 * transaction's tag chips open their tag, with a separate ×.
 * 2.7.0 puts a Year in review strip above Overview's greeting, all year,
 * and opens email links in the app: the web's /open hands off
 * tally://<web path>, which app/+native-intent.tsx maps to a screen
 * (@tally/core/appLinks); ?safe=1 opens the safe to spend sheet.
 * 2.7.1 shows the Overview strip only in January, for the year just ended,
 * and the review screen starts at (and stops at) the latest finished year,
 * as web 2.7.1 does.
 * 2.7.2 takes Year in review out of the More menu (lib/moreSheet.ts back
 * to 513pt); Overview's January strip is the way in.
 * 2.7.3 gives Tags' empty screen web's card, icon and title (EmptyState).
 * 2.8.0 adds Forecast, web 2.8.0's companion: the projected balance for the
 * next 30-90 days, the first day it falls under the buffer and the ledger
 * behind it, from the same GET /api/forecast and the same
 * @tally/core/forecast math. Reached from the More sheet (lib/moreSheet.ts
 * to 562pt) and Overview, with a How it works dialog and a one-time
 * announcement. No scrub gesture on the chart yet -- the ledger below it
 * carries every figure.
 * 2.8.1 fixes Android's floating tab bar in dark mode: dark's raised fill
 * and brand-subtle highlight sat a shade off the cards behind them and
 * Android drew no shadow, so the bar melted in. Dark now gets a firmer
 * outline and a brand-tinted highlight, and both schemes fade content out
 * under the bar and the gesture handle (an SVG scrim, no layout). Forecast's
 * chart scrubs (press and drag, same PanResponder as GoalChart) with a
 * readout of the day's balance and what lands that day, and its ledger's
 * "+ N more" expands instead of being a dead end. Server side, web 2.8.1
 * counts every subscription in Forecast, Safe to spend and Upcoming.
 * 2.8.2 gives Android's Budgets tab the pie chart iOS (chart.pie) and web
 * already use, in place of a piggy bank.
 * 2.8.3 mirrors web 2.8.2-2.8.3's What's coming on Forecast: one block per
 * day with a centred date tile, merchant initials, the day's closing balance
 * once under it, and an under-the-buffer flag in words. Rows open the card,
 * Subscriptions or Income schedules, as web's rows link.
 * 2.8.4 pads Forecast outside its ScrollView like every other pushed
 * screen (Investments' pattern): padded inside, its content slid up behind
 * the transparent header's title and back button.
 * 2.8.5 draws BootSplash's crossing stroke in light Pop's marigold
 * (#FFC53D, the loader-accent token) -- it was a dark ochre (#B87A00).
 * 2.9.0 follows web 2.10.0's account security: changing the password signs
 * this device out (the server ends every session), and changing the email
 * says to check the new inbox -- it only changes once that address confirms.
 * Sign-in shows the server's "too many attempts" message as-is.
 * 2.9.1 sends a revoked session to the login screen: refreshing from inside
 * the 401 retry awaited its own in-flight refresh forever, so a password
 * change elsewhere left the app hanging on Overview. The /api/auth/ calls
 * no longer go through that retry (which also showed "Session expired" for
 * a wrong password at login), and being offline during a refresh no longer
 * signs you out.
 * 2.9.2 puts web's legend under the Safe to spend meter (Bills, Cards,
 * Cushion with their amounts, then Safe), so each colour says what it is;
 * the card's spoken label reads the same breakdown.
 * 2.10.0 retires the classic look: Tally Pop is the only one. The look
 * context (lib/UiLookContext.tsx), the "New look" switch, NewLookDialog and
 * CLASSIC_FONTS are gone; useThemeColors always returns Pop's palette and
 * the root view always carries popVars. An install still showing the
 * "Classic" alternate icon is reset to the primary once (lib/appIcon.ts);
 * the alternate stays in app.json until the next native build.
 * 2.11.0 makes Forecast the one screen for what's ahead: Safe to spend
 * heads it (SafeToSpendCard with forecastLink off), the Upcoming screen,
 * Overview's Upcoming list and its bill sheet are gone (a bill is dismissed
 * from Subscriptions, where Forecast's rows lead), and the Safe to spend
 * sheet links to Forecast. tally:// links to /upcoming open /forecast, and
 * /forecast itself now opens in the app instead of falling back to
 * Overview (@tally/core/appLinks, +native-intent).
 * 2.12.0 folds Early retirement into Goals: app/goals.tsx is a tab bar
 * over components/goals/YearEndGoal.tsx and RetirementGoal.tsx (the old
 * goals and fire screens, minus their own header padding and glow), the
 * fire route is gone, the More sheet has one "Goals" row
 * (MORE_SHEET_CONTENT_HEIGHT 645 -> 596), and tally:// /fire opens
 * /goals?view=retirement.
 * 2.13.0 adds Loans (app/loans.tsx, GET /api/loans, a More row; sheet
 * height 645): every non-card debt with the lender's rate, next payment
 * and payoff when reported. Forecast's loan rows and Safe to spend's loan
 * payments open it; tally:// /loans does too.
 * 2.13.1 gives Android the cards' hard offset shadow iOS already had:
 * useStickerShadow returns a boxShadow there (Android 9+), where elevation
 * could only draw a soft shadow straight down.
 * 2.13.2 uses the device's date (lib/today.ts todayISO) for Overview's
 * Year in review strip and a card's "charges since" link, not UTC. The
 * "This month" $0 in the evening was the server's (web 2.14.1).
 * 2.13.3 folds Investments and Credit used into Overview's This month
 * card as its last row (StatPair inCard, MonthCard footer); the pair only
 * stands alone before the month's figures load.
 * 2.13.4 sends deviceInfo ("ios 26.1", "android 35") with the login, so
 * each device session (web 2.14.2) says which phone it is.
 * 2.13.5 shows "New month" on the On-pace card on a month's first day
 * (device date), with web's copy from @tally/core/popView onPaceLine.
 * 2.13.6 applies the saved light/dark choice before the first render
 * (theme/appearance.ts applyStoredAppearanceModeSync, SecureStore.getItem)
 * and to React Native's Appearance as well as NativeWind, so the boot
 * splash, native header and alerts follow it. It used to load
 * asynchronously after the first screens drew in the phone's theme:
 * a light choice on a phone in Dark Mode opened dark, then flipped.
 * 2.13.7 finishes that: NativeWind's colorScheme.set() only forwards to
 * Appearance and waits for a change event it ignores until the app is
 * "active", so Overview still drew in the phone's scheme first.
 * applyAppearanceMode now also sets NativeWind's systemColorScheme
 * observable directly (react-native-css-interop appearance-observables).
 *
 * 2.14.0 makes dark Pop pop, as web 2.15.0: cream ink outlines over a hard
 * grape shadow, the net-worth hero in solid grape on a marigold shadow.
 *
 * 2.14.1 is a consistency sweep: screens load behind skeletons, never a
 * centred spinner; PillButton (components/ui/PillButton.tsx, lg/md/sm) is
 * the one button, with the spinner beside a label that stays; "last month"
 * in filters and Year in review use this device's date, not UTC.
 *
 * 2.15.0 deepens dark Pop toward near-black: canvas #0A0910, surface
 * #14121C, surface-2/raised #1C1A27, sunken #060509, border #252233, and
 * the subtle tints darker to match (web and mobile together; text pairs
 * still AA, text-3 6.3:1 on surface).
 *
 * 2.15.1 reworks Goals: a full-width tab switch; the year-end tab leads
 * with the goal and its pace, then where to find it, then the goal's own
 * rows (target edits in a FormSheet, remove asks first); retirement snaps
 * to the type and radius scale. AppSlider is drawn in JS in Pop's colours
 * (ink-outlined track, brand fill, marigold thumb) instead of the native
 * SwiftUI/Material sliders, and locks the scroll while dragging.
 *
 * 2.15.2 stacks the budget sheet's Save and See transactions full width,
 * so "See transactions" no longer truncates at half width.
 *
 * 2.15.3 gives Add transaction's date, category and account rows (and the
 * Expense/Income switch) the same ink field outline as its text inputs.
 *
 * 2.16.0 floats every bottom sheet as a card (Sheet.tsx): inset 8pt from
 * the sides and bottom, all corners rounded concentric with the display
 * (46 iOS / 28 Android), hairline border. The inset comes out of the iOS
 * bottom padding so content ends where it did; Android sits above the nav bar.
 *
 * 2.16.1: sheets are see-through on iOS -- expo-blur (systemThickMaterial)
 * under a 72% wash of raised, backdrop eased to 30% (loader shared with
 * TallyDialog in ui/nativeBlur.ts). The native More sheet's corner radius
 * is 44 on iOS (was 24), so iOS 26's floating sheet clears the display's
 * corners instead of being clipped by them; its content is clear on iOS
 * (contentStyle transparent, more.tsx unpainted) so the system glass shows.
 *
 * 2.16.2: one glass recipe (ui/nativeBlur.ts): a 60% wash of raised over
 * the blur on every sheet -- custom sheets were at 72% (nearly solid) while
 * More had no wash (stained by what's behind). More's cards are surface-2
 * at 75% on iOS, and its title is left-aligned at 18pt.
 *
 * 2.16.3: the transaction detail opens as the same floating glass sheet on
 * iOS (formSheet at a 0.92 detent with GLASS_FORM_SHEET_IOS from
 * ui/nativeBlur.ts, SHEET_WASH painted by the screen) instead of a solid
 * full-height modal. Android keeps the modal.
 *
 * 2.16.4 never preselects an account: Add transaction, Add bill and income
 * schedules start with no account and the user must pick one.
 *
 * 2.17.0 rebuilds Add transaction as the approved "quick chips" design
 * (https://claude.ai/artifact/5yBCsdYtpRYBewyW1X5TDa): the amount is the
 * hero (Bricolage, focused on open), a pill Expense/Income switch, chips for
 * your top-5 categories (GET /api/categories/top, topped up with top-level
 * categories of that kind) and for Today/Yesterday/a date, an account row
 * that is never preselected, and "Add expense · $X" disabled until amount,
 * description and account are set. Switching kind clears the category.
 *
 * 2.17.1: Add transaction's amount no longer clips past 7 characters. The
 * field is as wide as an invisible measured twin of its text (no more
 * 0.62em guess), the number steps 60 -> 48 -> 40pt as it grows, and input
 * is capped at 7 whole digits + 2 decimals.
 *
 * 2.18.0: "Pop Calm", a quieter Pop on mobile only (web keeps the sticker
 * look). Cards drop the ink outline and hard offset shadow for a soft
 * shadow (light) or a hairline border (dark); corners go to 12 (cards) and
 * 8 (controls and buttons); the canvas turns a neutral warm grey. The net
 * worth hero leaves its solid grape card and sits on the canvas with a
 * taller (140pt) edge-to-edge chart and centered range buttons. Safe to
 * spend and on-pace days are plain surface cards (no marigold fill), and
 * section labels on the four tabs are sentence case instead of uppercase.
 * Sheets keep their floating glass: surface-2/raised and the panel radius
 * are unchanged.
 *
 * 2.19.0: Pop Calm feedback. Transaction rows (Transactions, Overview's
 * Recent, a card's charges) show the category as an icon in its own color
 * (CategoryAvatar: icon matched from the category name, then Plaid's
 * category) instead of the merchant logo. Every number is Figtree --
 * MoneyText/SplitMoney map font-display to the bold UI weight; Bricolage
 * is for titles only. Buttons are full pills again; text fields wear a
 * quiet 1px field-line instead of the ink outline; the net worth ranges
 * sit left. Budgets' year-end goal row is taller; on Overview the goal
 * card joins Safe to spend and on-pace days in one tighter group. Pushed
 * iOS screens turn off the iOS 26 full-screen back swipe, which stole
 * sideways drags on charts. Forecast stops calling a charged bill overdue
 * (core fix, web 2.17.1). Loans' empty state is the shared EmptyState card
 * with a way to Accounts; dialogs blur the screen behind less; Retirement
 * loads with full-width blocks instead of a centered skeleton.
 *
 * 2.19.1: numbers are Bricolage Grotesque, not Figtree (the user's call,
 * reversing 2.19.0's one detail). Medium/SemiBold/Bold are now loaded
 * beside ExtraBold (font-num / font-num-semibold / font-num-bold);
 * MoneyText maps a caller's UI weight to the matching Bricolage weight,
 * SplitMoney and big figures use font-display (800), and plain Texts that
 * show only a number use font-num*.
 *
 * 2.19.2: the net worth hero's change row (delta pill + range caption, or
 * the scrub date) is a fixed 26pt row that empties instead of collapsing,
 * so a range with no change to show no longer pulls the chart up.
 *
 * 2.19.3: CategoryAvatar draws a bold ellipse tilted -20deg in the
 * category's exact color (no tint) with a white icon; transfers on text-3,
 * uncategorized on warning.
 *
 * 2.19.4: CategoryAvatar is option 2 from the canvas: a soft circle, the
 * category color at 15% (22% dark) behind the icon in the full color.
 *
 * 2.19.5: Settings' Appearance switch is easier to hit: 36pt pill segments
 * (56pt min wide, 14pt text, 4pt vertical slop) instead of ~24pt ones.
 *
 * 2.19.6: the net worth range pills (1M/3M/6M/1Y) are outlined: 1px
 * field-line on each, brand on the selected one.
 *
 * 2.19.7: the "needs you" strip, Overview card and Fix sheet only count a bank the
 * user can fix -- a sign-in (@tally/core connectionState.needsAttention). A
 * bank that's down on its or Plaid's side keeps its own card notice and
 * Retry, and joins the strip once a retry fails or it's been down a day.
 *
 * 2.19.8: a bank card's notice stacks its text over a compact button
 * (InstitutionCard Notice) instead of squeezing the text beside it.
 *
 * 2.19.9: an "error" (outage) bank joins needs-you only after a full day down,
 * not after a failed retry -- Plaid's own 500s fail every retry, and signing
 * in wouldn't help.
 *
 * 2.20.0: the goal view comes to mobile, on the same opt-in as web
 * (users.goal_view_at, one account setting, toggled in Settings >
 * Preferences). Overview leads with net worth and its goal bar, then why
 * the pace is moving split into what you saved and what markets and debt
 * did, then six months of saving against what the goal needs. Budgets rows
 * become the month as a runway with what each one costs the goal. No skin
 * change: Pop Calm (2.18.0) already did mobile's de-pop.
 *
 * 2.20.1: the pace split's "needs $X" label hangs left of the dashed mark
 * instead of starting at it, where it ran off the card.
 */
export const APP_VERSION = "2.20.1";

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
