/**
 * The app's displayed version (shown in SideNav's footer, under the profile
 * row) — not tied to package.json's version, which is a workspace/build
 * concern, not a "what did the user's app just change" one.
 *
 * Bump this by hand on every user-visible change, right alongside the
 * change itself -- and add a matching user-facing entry to lib/changelog.ts: a new feature or a meaningful behavior change bumps minor
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
 * 1.10.0 redesigns Overview's cash flow chart (income/spend lines with the
 * gap shaded, paired bars under 4 months of data, a savings headline).
 * 1.10.1 adds a changelog page, linked quietly from the bottom of Settings.
 * 1.10.2 reworks its layout (version rail, changes grouped by kind).
 * 1.11.0 makes the refined dark palette the only dark mode and removes the
 * preview toggle. 1.12.0 refines light mode ("light v2"): white cards on a
 * deeper canvas, AA-passing info/focus ring and input borders, and a
 * greener positive that no longer matches the brand. 1.12.1 deepens --brand-subtle (#E4EEE9 ->
 * #D0E3D9): it was 1.04:1 on the new canvas, so tinted pills vanished.
 * 1.12.2 stops treating a holding Plaid matched to an OTC cross-listing
 * (VFV -> VFVXF, mic OOTC) as USD; the holding's own label decides.
 * 1.13.0 regroups the side nav (Your money / What you have / What you owe
 * / Plan ahead) with icons and dividers, adds Rules to it, renames FIRE
 * calculator to Early retirement, and compacts the footer into an icon row.
 * 1.13.1 replaces that unlabeled icon row with a labeled Hide amounts /
 * theme pill, and moves Settings and Sign out next to the profile.
 * 1.13.2 swaps that pill for two nav-style rows (Hide amounts with a
 * switch, Appearance showing the current theme) above the profile row.
 * 1.13.3 works out "this month" and "today" in the user's timezone
 * (users.timezone) instead of the server's UTC, which rolled the month
 * over at 8 PM Eastern. 1.13.4 tidies Cash flow's headline with amounts
 * hidden: the savings rate (a ratio) stays visible and the masked figure
 * no longer leaves a gap before its label. 1.13.5 restacks that headline:
 * figure + savings-rate chip, then the label and window on a second line.
 * 1.14.0 adds the alerts engine (ALERTS.md): budget steps, connection
 * breaks, large purchases and subscription changes, recorded once each;
 * email for broken connections now, push once the mobile app registers.
 * 1.15.0 adds Settings → Alerts: push/email per type, the large-purchase
 * threshold, show-amounts, a test send and recent alert history.
 * 1.15.1: per-type alert email wording, failed sends shown in Recent
 * alerts, and the test send removed (scripts/delete-test-alerts.ts).
 * 1.15.2 drops push (no iOS push without an Apple Developer account):
 * alerts are email only, on by default for every type.
 * 1.16.0 opens every "add" form (budget, bill, transaction, rule, income
 * schedule, API token) in the same right-hand side panel, from a button
 * in the page header instead of an inline form (components/ui/FormPanel.tsx),
 * and gives every page one shared header (components/ui/PageHeader.tsx):
 * title + context line, with Transactions using the headline-figure variant.
 * 1.16.1 fixes Early retirement's saved assumptions: the expenses and
 * contribution overrides were saved but never loaded back (now kept only
 * when they differ from actual spending, with a "Use actual" reset), the
 * API now accepts the rates as strings (older mobile builds sent them that
 * way and every save 400'd), and a failed save says so. GET
 * /api/transactions also returns a spend/unreviewed summary for mobile.
 * 1.16.2 stops large-purchase alerts for old charges: a sync's "added" rows
 * include Plaid's historical backfill, so a months-old purchase alerted as
 * new. Only charges dated within 7 days alert now, and alert emails carry
 * the charge's date. Also: the monthly recap's subscriptions total counted
 * dismissed streams and ignored spread plans' terms; it, the Subscriptions
 * page and mobile now share @tally/core/subscriptionMath, which also leaves
 * manually added bills (rent) out of the subscriptions total and count.
 * 1.17.0 redesigns Accounts around connection health, sharing
 * @tally/core/connectionState with mobile: a summary band with a health
 * meter, a "Needs you" panel listing each problem with its reason and a
 * state-colored fix (sign in, renew, retry, sync now, reconnect/remove),
 * cards sorted by urgency that size together in pairs (no fixed 440px
 * height), a bank side panel (?bank=<itemId>) with exact times and
 * sync_runs history replacing the "⋯" menu, a sidebar count on Accounts,
 * and a first-run card. Broken-connection alert emails deep-link to the
 * bank's panel. Also keeps an exactly-met budget's bar out of amber.
 * 1.18.0 redesigns Investments (@tally/core/investments, shared with
 * mobile): a value-over-time chart with money-in drawn under it and a
 * 1M/3M/YTD/1Y/All switch (lib/portfolio.ts portfolioHistory, from daily
 * holdings snapshots; also GET /api/investments/history), "Invested" and
 * "Growth" replacing the four stat tiles, allocation by type/account/
 * holding, one holdings table rolled up across accounts with gain per
 * position, sort and an account filter, activity in plain verbs with type
 * filters, a holding side panel (?holding=), and stale-connection notices
 * from connectionState. /api/investments/transactions now returns
 * converted amounts and account names.
 * 1.19.0 redesigns Budgets (@tally/core/budgetView, shared with mobile):
 * "left to spend" with a per-day allowance, rows grouped by parent
 * category in each budget's own color with a pace tick and "On pace for"
 * projection (amber 80-<100%, red overage -- replacing green/amber/red),
 * a "Not budgeted" row, "Worth a look" nudges, one-tap setup for an empty
 * month (copy last month / 3-month averages, POST /api/budgets/setup), a
 * past-month report, and a budget side panel with 6-month history
 * (GET /api/budgets/history), plain toggles and Remove with undo.
 * 1.20.0 redesigns Transactions (@tally/core/transactionView, shared with
 * mobile): rows grouped under sticky day headers with each day's net, one
 * status mark per row, the category chip as an inline picker, who set the
 * category ("by rule / by you / by Tally"), multi-select with a bulk bar
 * (set category, mark reviewed, exclude), keyboard (j/k/x/c/e/Enter, /,
 * Esc), a "To review" filter (?review=1), and "Review N": a one-at-a-time
 * queue in a side panel (GET /api/transactions/review) with suggestions
 * from the merchant's history and "Always use … for <merchant>" rules.
 * 1.21.0 redesigns Early retirement (components/fire/FirePlanner.tsx): the
 * answer first (age and year), a projection chart with the target line,
 * a ±1% return band and the crossing labeled, what-ifs in years,
 * milestones (25/50%, Lean, Coast, FIRE), and levers that autosave --
 * now including inflation (the projection uses the return after
 * inflation; @tally/core/fireMath realReturn) and a choice of which
 * investment accounts count. "Invested today" comes from lib/fire.ts,
 * converted to CAD like Investments (it summed raw balances), and the
 * monthly recap uses the same inputs. Needs migration 0022.
 * 1.21.1 shows a fixed budget's "Fixed" as a chip instead of loose text.
 * 1.21.2 opens Subscriptions' edit-next-date form in a centered dialog
 * (components/subscriptions/NextDueDateEditor.tsx) instead of a popover the
 * table's scroll container clipped.
 * 1.22.0 is the server side of mobile Overview v2: upcoming bills stay
 * listed 3 days past due and come first marked overdue (a card only when
 * Plaid flags isOverdue); a card with no reported minimum has a null amount
 * ("Min. unknown") plus its statement balance; PATCH /api/recurring-streams
 * accepts { dismissed: false } to restore a dismissed stream and GET
 * /api/recurring?dismissed=1 lists them. The web Overview's Upcoming card
 * shows the overdue label and "Min. unknown".
 * 1.23.0 redesigns the transaction edit panel (TransactionDetailPanel.tsx):
 * category first with who set it, up to 3 suggestions (now returned by GET
 * /api/transactions/[id]) and the merchant rule; "How it counts" (excluded,
 * Split and Spread as their own views); note and tags; folded Details.
 * Every change saves on its own with an Undo toast -- only Split, which has
 * to add up first, has a Save. Spread is confirmed with a preview and can
 * change term or stop. Delete asks first. ?tx= deep-links the panel and
 * j/k move between transactions. Rules: @tally/core/transactionView's
 * describeTransactionDetail.
 * 1.24.0 shows merchant logos on transaction rows and the edit panel
 * (components/transactions/MerchantAvatar.tsx), falling back to the first
 * letter. lib/merchantLogos.ts resolves them from what sync already stores:
 * Plaid's logo_url, then a counterparty's logo, then another transaction
 * from the same merchant. GET /api/transactions and /api/transactions/[id]
 * return it as logoUrl.
 * 1.24.1 puts logos on a white tile in both themes; dark marks on a
 * transparent background (Uber's wordmark) disappeared on the dark tile.
 * 1.25.0 redesigns Credit cards around @tally/core/cardView: payments found
 * in a card's transactions since its statement (isCardPayment) or the
 * bank's own record mark it paid, so Upcoming no longer lists a paid card
 * at $0.00 and shows what's left on a partly paid one. The page is flat:
 * You owe / Next payment / Credit used, one table of cards with brand tiles
 * (institutions' color + logo, cardNetwork), and a ?card= side panel with
 * the statement cycle, charges, APRs, name and limit. GET /api/liabilities
 * adds each card's view and an institutions brand map.
 * 1.25.1 moves the large card tile's last four digits to the top-right
 * (they ran into the network mark). The AMEX badge stays on Amex cards
 * even next to Amex's own logo.
 * 1.30.1 drops Settings' sticky section menu; sections stack in one column
 * and the version/Changelog line sits at the bottom at every width.
 * 1.30.2 centers that column on the page.
 * 1.31.0 adds a public read-only demo at /demo: one shareable
 * link signs a visitor into a pre-seeded demo household with no sign-up,
 * and every write is refused at the middleware gate for that session.
 * 1.32.0 adds the Tally Pop UI preview behind a link-only flag: /labs/pop
 * sets the tally-ui cookie (lib/uiFlag.ts), ?off clears it, and
 * globals.css restyles everything under html[data-ui="pop"].
 * 1.32.1 makes /labs/pop a real feature flag (tally-ff-pop): a flagged
 * browser gets a "New look" switch in the sidebar to flip between Pop and
 * the current UI; unflagged browsers see neither.
 * 2.0.0 completes Tally Pop end to end, still behind the flag: the flag is
 * also kept on the account (users.ui_look, migration 0025) so the monthly
 * recap and alert emails have Pop versions; Overview gets a greeting with
 * what's left to spend, a brand net-worth card, an on-pace streak in tally
 * marks and an "N to tally up" banner; the review queue counts in tally
 * marks; overlays, modals, side panels, meters, titles and every chart
 * (edge to edge, labels kept inside) take the new look. Also fixes the
 * Investments chart labelling every tick with the same month on 1Y/All
 * when the history is short.
 * 2.0.1 rounds out Tally Pop: the loader in Pop's colors (a solid tile,
 * marigold crossing), Pop's tab icon (public/icon-pop.svg), and the mobile
 * app's side -- GET /api/account returns uiLook, GET /api/analytics/overview
 * returns the on-pace streak.
 * 2.0.2 fixes Investments' money-in: an account linked after the history
 * began had its backfilled deposits counted on top of its starting value
 * (which already holds them), inflating "Invested"/"added" and pushing
 * growth negative. Contributions now count only after their own account's
 * first snapshot, in the chart history (@tally/core/investments) and the
 * simple return (lib/portfolio.ts).
 * 2.1.0 adds year-end goals, Tally Pop only (the Year-End Goals spec): one
 * net worth target and deadline (goals table, migration 0026), projected
 * from net worth's 3-month pace (@tally/core/goalMath) -- an Overview card,
 * a /goals page with the projection chart, suggested cuts and the form, a
 * line on Budgets, the goal_off_track alert (migration 0027) and a goal
 * section in the Pop recap. A one-time announcement on Overview
 * (users.goals_intro_seen_at, migration 0028); "Not now" leaves the
 * "Set a goal" card in place. GET/PUT/DELETE /api/goals, POST /api/goals/intro.
 * 2.1.1 gives Pop's Overview header a sticker pill for connections that
 * need you (icon + words), in place of the plain red link.
 * 2.1.2: Pop's goal card and "N to tally up" banner fade in with the rest
 * of Overview (reveal), and the hand-built buttons that missed Pop's
 * outline get the ui-btn hooks -- Accounts' fix buttons (StateButton,
 * also on Investments), the public pages' Sign in and the demo CTAs.
 * 2.1.3: the year-end goal's amounts follow "hide amounts" (a goal is net
 * worth) -- card, Goals page header and chart label, Budgets line.
 * 2.1.4 masks those amounts inline (money-fit): plain .money kept each
 * hidden figure's width, leaving gaps in the middle of sentences.
 * 2.1.5 puts the goal card's target on the line under the big figure
 * ("of $X · $Y to go"), so each line is one size, masked or not.
 * 2.1.6 turns Budgets' goal line into a one-line row: "Year-end goal ·
 * On track · $X to go" with a chevron, in place of a wrapping sentence.
 * 2.1.7 leads the goal card with what's left ("$X" / "left to reach $Y by
 * Dec 31"), not net worth again under Overview's net worth card; the Goals
 * page adds "now $Z" (showCurrent), having no net worth card of its own.
 * 2.1.8 sets Cash flow's headline and the budget panel's spent/budget
 * figures in Pop's display face (the ui-figure hook).
 * 2.1.9 leads the Pop recap's goal section with what's left, like the
 * app's goal card, instead of repeating net worth under its own card.
 * 2.2.0 makes Tally Pop the default for everyone: Pop unless a browser
 * chose classic (lib/uiFlag.ts), an account with no choice counts as Pop
 * for emails and alerts (lib/uiLook.ts), the "New look" switch shows for
 * everyone, and Pop's icon is the tab icon (app/icon.svg; classic in
 * public/icon-classic.svg). Year-end goals come with it.
 * 2.2.1 announces the new look once per account on Overview
 * (components/overview/NewLookModal.tsx, recorded in
 * users.seen_announcements by lib/announcements.ts), ahead of the goals
 * intro, which now waits for the next visit.
 * 2.2.2 adds "How it works" to the Goals page (components/goals/
 * GoalHowItWorks.tsx), its words in @tally/core/goalMath GOAL_HOW_IT_WORKS.
 * 2.2.3 puts the Goals chart on a real time scale: the projection is one
 * point months past the last recorded day, and the category axis gave it
 * one day's width, squashing the rest of the year into a sliver at the
 * edge (mobile already scaled by time). The goal form groups the amount's
 * digits as you type, sizes its fields to what they hold instead of
 * stretching the money box across the card, and asks before removing.
 * 2.2.4 gives Rules the table treatment Transactions has: a column header,
 * rows scrolling inside the card and a pager under them, 25 to a page
 * (?page=). The footer both pages share is components/ui/Pager.tsx.
 * Enabled is a Switch, not a checkbox, and no longer sticks disabled after
 * one toggle (the row's busy flag was never cleared on success).
 * 2.2.5 fixes that header, which rendered as one word: RULE_COLUMNS was an
 * export of RuleRow ("use client"), and a server component importing a
 * value from a client module gets a client reference, not the string -- so
 * the header's className lost its grid while the rows kept theirs. It
 * lives in components/rules/ruleColumns.ts now, and the first column is
 * labelled Priority rather than "#".
 * 2.2.6 stops an account the user unticked during a reconnect from counting
 * (accounts.deselected_at, migration 0030). Plaid stops returning it, so
 * nothing ever refreshed it again, but lib/plaidAccounts.ts only dropped
 * the row when nothing hung off it -- one with history stayed live and its
 * frozen balance kept counting in net worth, card and investment totals
 * forever. It's marked instead, and liveAccount/isLiveAccountRow leave it
 * out of everything that reads current money, exactly as they do a
 * disconnected bank's accounts; its transactions still count and the
 * Accounts page lists it under "No longer shared". Ticking it again in
 * Link clears the mark.
 * 2.2.7 prunes investment transactions Plaid reissued under a new id
 * (lib/plaidInvestments.ts): the stale copy counted every Wealthsimple
 * transfer twice in "Invested" and drove growth negative.
 * 2.2.8 asks before every removal that didn't yet: a budget (BudgetPanel)
 * and a split (TransactionDetailPanel) confirm inline, as deleting a
 * transaction does in a panel; a manual card limit (CreditLimitEditor)
 * through useConfirmAction.
 * 2.2.9 centres a dialog's title on its icon tile (DialogHeader): a
 * one-line title with no subtitle sat at the tile's top edge.
 * 2.3.0 finds a monthly subscription from its second charge when the two
 * match exactly -- same name, same amount to the cent, same day of
 * back-to-back months (@tally/core/recurringDetection isMonthlyPair) --
 * instead of waiting ~60 days for a third. Low confidence, like the annual pair.
 * 2.3.1 lets that pair's second charge land up to 3 days either side of the
 * same day, and compares Plaid's authorized_date (when the merchant charged)
 * over the posted date: weekends and settlement lag moved the posted day.
 * 2.3.2 drops the "Your money" label above Transactions' title (and
 * PageHeader's eyebrow prop, which only it used).
 * 2.3.3 offers "Always use … for transactions like …" when Plaid gives no
 * merchant name (payroll deposits): the rule matches the description's
 * words minus anything holding a digit (@tally/core/rulesEngine
 * ruleTargetFor), so a picked category sticks for the next paycheque. The
 * switch used to show only with a merchant, so nothing carried forward.
 * 2.4.0 adds safe to spend, Tally Pop only (the Safe to Spend spec): cash
 * in counted accounts minus bills and card payments due before payday and
 * a cushion (@tally/core/safeToSpend, loaded by lib/safeToSpend.ts, GET
 * /api/safe-to-spend). Payday comes from the synced paycheque
 * (@tally/core/paycheque: same payer, amounts within 15%, a weekly,
 * biweekly, semi-monthly or monthly cadence, the last three on time),
 * else the income schedule, else month end. Overview's right column
 * stacks it over a smaller on-pace card at equal heights, with a ?safe=1
 * breakdown panel. Settings gets "Next paycheque" under Income and a Safe
 * to spend section (accounts that count, cushion, due days for cards that
 * report none; PUT /api/safe-to-spend/settings), and the safe_to_spend_low
 * alert ($100 default, adjustable) emails once per pay window. Uses
 * migrations 0031 and 0032.
 * 2.4.1 renders SidePanel into <body> (createPortal): Overview's reveal()
 * entrance animation leaves a transform on its row, which makes that row
 * the containing block for position: fixed, so the safe to spend panel
 * opened inside the card's row instead of over the window. Also GET
 * /api/safe-to-spend/settings (lib/safeToSpend.ts safeToSpendSettingsFor,
 * shared with the Settings page) for mobile.
 * 2.4.2 draws Pop's hard offset shadow in the ink outline's color in dark
 * mode (--ink-shadow #6E6895): pure black on the #14121F canvas hid the
 * sticker edge of every card, panel and button.
 * 2.4.3 fits the side nav in a ~800px window: it had grown to ~950px (13
 * rows, four dividers with 16px either side, Pop's taller Figtree), so it
 * scrolled on most laptops. Rows and the display toggles go to py-1.5,
 * group gaps to 10px; it still scrolls in a shorter window.
 * 2.4.4 puts the safe to spend breakdown's sum on a real card (Pop's ink
 * outline and shadow; it was a bare tint that vanished in dark mode) and
 * passes its subtracted amounts as magnitudes: the labels carry the minus,
 * so the cushion read "− Cushion −$50.00".
 * 2.4.5 makes a card's due day (Settings → Safe to spend) a select -- Not
 * set, 1st-30th, Last day -- instead of the money field, which took any
 * number of digits; the row says what it's for.
 * 2.4.6 swaps that 32-row select for a day grid popover
 * (components/ui/DayOfMonthPicker.tsx): 1-31, Last day, Clear.
 * 2.4.7 draws the Delete data card's Pop shadow in the same negative tint
 * as its outline (.ui-card-negative), instead of ink beside a red edge.
 * 2.5.0 adds Year in review (/year-in-review, ?year= for past years; GET
 * /api/year-in-review): net worth over the year, money in and out, spend
 * by month, top categories and places, biggest and calmest months, and
 * subscriptions a year, from lib/yearReview.ts and @tally/core/yearReview.
 * Overview shows a Pop banner into it in December and January
 * (reviewSeason).
 * 2.6.0 adds tags as rollups: /tags lists every tag with its net spend,
 * count and dates, /tags/[tag] adds one up (@tally/core/tagView: total,
 * per day, day by day, by category; lib/tags.ts, GET /api/tags and
 * /api/tags/[tag]). Transactions filters by ?tag= (any date unless dates
 * are given, on web and the API), the bulk bar gets Tag
 * (components/transactions/TagPicker.tsx), the panel's tag chips link to
 * their page with a separate ×, and the side nav gets Tags.
 * 2.6.1 stops SidePanel re-focusing itself on every render (its effect
 * depended on callers' fresh onClose; now read through a ref): the "+ Tag"
 * field autofocused, blurred at once and closed, so the button did nothing.
 * 2.7.0 pins a Year in review sticker in the side nav, all year
 * (featuredReviewYear), and sends email buttons through /open
 * (app/open/page.tsx, public in middleware): on a phone it tries
 * tally://<path> -- the app's own scheme, since universal links need a
 * paid Apple Developer account -- with the browser as the fallback; on a
 * computer it redirects to the page. @tally/core/appLinks holds the safe
 * path check and the web-to-app path mapping.
 * 2.7.1 shows Year in review only for finished years: the sticker and the
 * Overview banner in January for the year just ended (featuredReviewYear),
 * and the page and API default to and stop at latestCompleteYear.
 */
export const APP_VERSION = "2.7.1";

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
