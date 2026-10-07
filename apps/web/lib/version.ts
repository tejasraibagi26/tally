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
 */
export const APP_VERSION = "1.25.2";

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
