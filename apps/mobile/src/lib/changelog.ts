/**
 * Mobile's user-facing changelog, newest first -- shown on the Changelog
 * screen (app/changelog.tsx), reached only by tapping the build line at the
 * bottom of the More sheet (kept deliberately quiet, like web's
 * /settings/changelog). Add an entry alongside every APP_VERSION bump in
 * lib/version.ts, written for the person using the app. Starts at 1.4.0,
 * when the version counter was introduced.
 */
export type ChangeKind = "new" | "improved" | "fixed";

export interface ChangelogEntry {
  version: string;
  date: string; // YYYY-MM-DD
  changes: { kind: ChangeKind; text: string }[];
}

export const CHANGELOG: ChangelogEntry[] = [
  {
    version: "1.27.1",
    date: "2026-10-05",
    changes: [{ kind: "fixed", text: "The More sheet is tall enough again: Sign out no longer sits on the bottom edge, and the version line shows." }],
  },
  {
    version: "1.27.0",
    date: "2026-10-05",
    changes: [
      { kind: "new", text: "Credit cards on your phone: what you owe, your next payment, and each card's statement, from More or by tapping Credit used on Overview." },
      { kind: "new", text: "Cards show your bank's logo and color with the Visa, Mastercard or Amex mark." },
      { kind: "fixed", text: "A card payment you've already made no longer shows in Upcoming as $0.00, and a partly paid card shows how much is in." },
    ],
  },
  {
    version: "1.26.1",
    date: "2026-10-05",
    changes: [{ kind: "fixed", text: "Merchant logos with dark lettering, like Uber's, are now visible in dark mode." }],
  },
  {
    version: "1.26.0",
    date: "2026-10-05",
    changes: [{ kind: "new", text: "Transactions show the merchant's logo where your bank provides one, instead of just the first letter." }],
  },
  {
    version: "1.25.2",
    date: "2026-10-05",
    changes: [{ kind: "improved", text: "Transactions: the list is one continuous table, grouped by day, instead of a separate card for each day." }],
  },
  {
    version: "1.25.1",
    date: "2026-10-05",
    changes: [{ kind: "fixed", text: "Transactions: the title no longer gets cut off, and \"To review\" no longer shows up inside the Filters button." }],
  },
  {
    version: "1.25.0",
    date: "2026-10-05",
    changes: [
      { kind: "improved", text: "Editing a transaction is redesigned: the category comes first, with who set it and up to three suggestions one tap away." },
      { kind: "improved", text: "Changes save as you make them, with Undo. No more Save button." },
      { kind: "new", text: "Add tags, split a transaction across categories, and tell Tally to always use a category for a merchant, right from your phone." },
      { kind: "new", text: "Spreading a prepaid plan shows the monthly amount before you confirm, and you can change the term or stop it later." },
      { kind: "fixed", text: "Delete only shows on transactions you added, since synced ones can't be deleted." },
    ],
  },
  {
    version: "1.24.1",
    date: "2026-10-05",
    changes: [{ kind: "fixed", text: "Overview: \"View all\" under Upcoming now always shows, so the full Upcoming list is reachable even with only a few bills." }],
  },
  {
    version: "1.24.0",
    date: "2026-10-05",
    changes: [
      { kind: "improved", text: "Overview: a bill that's past due stays at the top of Upcoming for a few days, marked Overdue, instead of disappearing." },
      { kind: "fixed", text: "A card payment whose bank doesn't report a minimum now says \"Min. unknown\" instead of $0.00." },
      { kind: "new", text: "Undo right after \"This won't recur\", and a Dismissed list in Subscriptions to bring a bill back." },
    ],
  },
  {
    version: "1.23.0",
    date: "2026-10-05",
    changes: [
      { kind: "new", text: "Overview: \"View all\" under Upcoming opens a full list of the next 30 days, card payments included." },
      { kind: "improved", text: "Overview: Credit used tells you when one card is high even if your total is fine, and \"Saved so far\" no longer turns red before payday." },
      { kind: "improved", text: "Overview: the net worth chart marks today with a dot, and banks that need you fit on one line." },
    ],
  },
  {
    version: "1.22.0",
    date: "2026-10-05",
    changes: [
      { kind: "improved", text: "Overview: Upcoming no longer lists money coming in, like a bonus or paycheck, or patterns Tally isn't sure about, and a bill you've removed stays removed." },
      { kind: "new", text: "Overview: tap a bill Tally guessed and choose \"This won't recur\" to stop it showing up." },
    ],
  },
  {
    version: "1.21.3",
    date: "2026-10-05",
    changes: [{ kind: "improved", text: "Overview: net worth is bigger, the \"transactions to review\" bar is now green, and the small marker on the This month bar is gone." }],
  },
  {
    version: "1.21.2",
    date: "2026-10-05",
    changes: [{ kind: "fixed", text: "Overview: \"transactions to review\" now counts only this month, and the review screen it opens skips older months." }],
  },
  {
    version: "1.21.1",
    date: "2026-10-05",
    changes: [
      { kind: "improved", text: "Overview: Credit used now shows your balance and limit, and says when a card without a limit isn't counted." },
      { kind: "fixed", text: "Credit used no longer drops when a card is overpaid, and cards in different currencies are now added up correctly." },
    ],
  },
  {
    version: "1.21.0",
    date: "2026-10-05",
    changes: [
      { kind: "improved", text: "Overview redesigned: banks that need you and transactions to review now show only when there's something to do, and one \"This month\" card covers what you've spent against your budget, your income and what you saved." },
      { kind: "improved", text: "Overview: net worth has a clearer change chip and a 1M / 3M / 6M / 1Y range, bills show when they're due, and recent activity matches the Transactions list." },
    ],
  },
  {
    version: "1.20.2",
    date: "2026-10-05",
    changes: [{ kind: "improved", text: "Budgets: fixed budgets like rent are marked with a clear \"Fixed\" tag." }],
  },
  {
    version: "1.20.1",
    date: "2026-10-05",
    changes: [{ kind: "fixed", text: "iPhone: sheets that slide up from the bottom no longer have a tall empty gap under their last button." }],
  },
  {
    version: "1.20.0",
    date: "2026-10-05",
    changes: [
      { kind: "improved", text: "Early retirement redesigned: the age and year you could retire up top, a clearer chart, what each change is worth in years, and milestones on the way." },
      { kind: "improved", text: "Accounts for inflation and converts US-dollar accounts to CAD, and changes save as you go." },
    ],
  },
  {
    version: "1.19.0",
    date: "2026-10-05",
    changes: [
      { kind: "new", text: "Transactions: tap Review to go through new transactions one at a time. Swipe right to confirm the category, left to pick another." },
      { kind: "improved", text: "Transactions are grouped by day with each day's total. Tap a category to change it, or swipe a row for quick actions." },
    ],
  },
  {
    version: "1.18.0",
    date: "2026-10-05",
    changes: [
      { kind: "improved", text: "Budgets redesigned: what's left to spend and about how much a day, with budgets grouped like your categories." },
      { kind: "new", text: "Each bar marks an even pace and warns when you're on track to go over. Spending without a budget shows as \"Not budgeted\"." },
      { kind: "new", text: "Set up a new month in one tap, and tap a budget for 6 months of history. Removing one can be undone." },
    ],
  },
  {
    version: "1.17.0",
    date: "2026-10-05",
    changes: [
      { kind: "new", text: "Investments: a chart of your portfolio over time, with the money you put in underneath. Drag across it to see any day." },
      { kind: "improved", text: "Invested and Growth replace the old return numbers, and each holding shows its gain." },
      { kind: "new", text: "See all your holdings in one list, filter by account and sort, then tap one for what you paid and its activity." },
      { kind: "improved", text: "Activity reads plainly (\"Bought 12 XEQT\", \"Dividend from VFV\"), with your income and contributions this year." },
    ],
  },
  {
    version: "1.16.5",
    date: "2026-10-05",
    changes: [{ kind: "fixed", text: "Budgets: a budget you've spent exactly in full keeps its own color instead of turning amber." }],
  },
  {
    version: "1.16.4",
    date: "2026-10-05",
    changes: [{ kind: "fixed", text: "Accounts: net worth, assets and debts at the top now line up." }],
  },
  {
    version: "1.16.3",
    date: "2026-10-05",
    changes: [
      { kind: "improved", text: "Accounts: each account shows its type (Savings, Credit card, TFSA), and card and loan balances show a minus sign so they add up with the bank's total." },
      { kind: "improved", text: "Renaming an account shows the name you're replacing. Tap or long-press an account's name to rename it." },
    ],
  },
  {
    version: "1.16.2",
    date: "2026-10-05",
    changes: [{ kind: "improved", text: "Accounts: your total debts now show in red at the top, so they stand apart from your assets." }],
  },
  {
    version: "1.16.1",
    date: "2026-10-05",
    changes: [{ kind: "fixed", text: "Accounts: the last-synced time and account count in a bank's menu are readable again." }],
  },
  {
    version: "1.16.0",
    date: "2026-10-05",
    changes: [
      { kind: "improved", text: "Accounts redesigned: your net worth, assets and debts up top, and banks that need you listed first with a clear reason and a one-tap fix." },
      { kind: "new", text: "When one or more banks need attention, a strip at the top opens a list where you can fix them all in one place." },
      { kind: "improved", text: "Each problem gets its own fix: sign in again, renew access before it runs out, or retry when the bank itself is down." },
      { kind: "fixed", text: "Reconnecting one bank no longer makes every Reconnect button spin, and a missing balance shows as \"—\" instead of $0.00." },
    ],
  },
  {
    version: "1.15.1",
    date: "2026-10-03",
    changes: [{ kind: "fixed", text: "Android: the tab bar's tabs are evenly spaced again, with the highlight under the tab you're on." }],
  },
  {
    version: "1.15.0",
    date: "2026-10-03",
    changes: [{ kind: "improved", text: "Android: a new floating tab bar, with a highlight that slides to the tab you pick." }],
  },
  {
    version: "1.14.1",
    date: "2026-10-03",
    changes: [{ kind: "fixed", text: "Face ID is only asked when you open Tally (or come back after 5 minutes away), not every time you open the app switcher or swipe away briefly." }],
  },
  {
    version: "1.14.0",
    date: "2026-10-03",
    changes: [{ kind: "new", text: "A new opening screen: the Tally mark draws itself while your accounts load, so the app opens with your numbers ready." }],
  },
  {
    version: "1.13.1",
    date: "2026-10-01",
    changes: [
      { kind: "fixed", text: "Subscriptions' monthly total now matches the website and the monthly recap email." },
      { kind: "improved", text: "Subscription totals only count subscriptions Tally found on its own. Bills you add yourself, like rent, aren't counted." },
    ],
  },
  {
    version: "1.13.0",
    date: "2026-10-01",
    changes: [
      { kind: "new", text: "Add a bill from Subscriptions, for recurring charges Tally hasn't picked up on its own." },
      { kind: "improved", text: "Adding an income schedule or API token opens a sheet from Add at the top of the screen." },
      { kind: "improved", text: "Screen headers show the period, counts and when your accounts last synced. Transactions leads with how much you've spent and how many are left to review." },
      { kind: "fixed", text: "Early retirement: Save now keeps your assumptions, including the expenses and contribution you typed in." },
    ],
  },
  {
    version: "1.12.0",
    date: "2026-09-30",
    changes: [{ kind: "new", text: "Settings → Alerts: choose which budget, large purchase, subscription and connection alerts to get by email, set your large purchase amount, and see recent alerts." }],
  },
  {
    version: "1.11.2",
    date: "2026-09-30",
    changes: [{ kind: "fixed", text: "On iPhone, the More menu no longer has empty space below the build line." }],
  },
  {
    version: "1.11.1",
    date: "2026-09-30",
    changes: [{ kind: "fixed", text: "The More menu is only as tall as its contents, with no empty space at the bottom." }],
  },
  {
    version: "1.11.0",
    date: "2026-09-30",
    changes: [
      { kind: "improved", text: "The More menu is grouped into Your money and Account, with the same names and icons as the web app." },
      { kind: "improved", text: "The FIRE calculator is now called Early retirement." },
    ],
  },
  {
    version: "1.10.1",
    date: "2026-09-30",
    changes: [{ kind: "fixed", text: "In light mode, the light green buttons (Sync, Add account, Filters) are visible again." }],
  },
  {
    version: "1.10.0",
    date: "2026-09-30",
    changes: [{ kind: "improved", text: "Refreshed light mode, matching the web app: cards stand out more clearly from the background, borders are easier to see, and gains are a distinct green from buttons and links." }],
  },
  {
    version: "1.9.2",
    date: "2026-09-30",
    changes: [
      { kind: "improved", text: "On Android, the top bar on Investments, Settings and other screens is transparent, so the page shows through to the top of the screen." },
      { kind: "fixed", text: "The Android bottom tab bar is back to solid, as before 1.9.0." },
    ],
  },
  {
    version: "1.9.1",
    date: "2026-09-30",
    changes: [{ kind: "fixed", text: "On Android, the see-through tab bar actually looks see-through in dark mode instead of solid black." }],
  },
  {
    version: "1.9.0",
    date: "2026-09-30",
    changes: [
      { kind: "improved", text: "On Android, the tab bar is see-through: content scrolls underneath it instead of stopping above it." },
      { kind: "improved", text: "On Android, the back button is a plain arrow without the circle behind it." },
    ],
  },
  {
    version: "1.8.1",
    date: "2026-09-30",
    changes: [{ kind: "new", text: "This changelog. Tap the build line at the bottom of More to get here." }],
  },
  {
    version: "1.8.0",
    date: "2026-09-30",
    changes: [{ kind: "improved", text: "Refreshed dark mode, matching the web app: clearer text and borders, cards that stand out from the page, and sheets that sit on their own raised surface." }],
  },
  {
    version: "1.7.1",
    date: "2026-09-30",
    changes: [{ kind: "improved", text: "The net worth chart on Overview runs edge to edge and is taller." }],
  },
  {
    version: "1.7.0",
    date: "2026-09-30",
    changes: [
      { kind: "new", text: "Prepaid plans can be spread across 3, 6, 9 or 12 months, starting with the month you paid. Pick the length from a transaction or on Subscriptions." },
      { kind: "fixed", text: "Marking a charge as spread after the fact no longer skips the months that already passed." },
    ],
  },
  {
    version: "1.6.3",
    date: "2026-09-30",
    changes: [{ kind: "improved", text: "Every budget gets its own color, so similar categories are easy to tell apart." }],
  },
  {
    version: "1.6.2",
    date: "2026-09-30",
    changes: [{ kind: "improved", text: "Investments' Sync button moved into the top bar." }],
  },
  {
    version: "1.6.1",
    date: "2026-09-30",
    changes: [{ kind: "improved", text: "On Android, the top bar of Investments, Settings and other screens blends into the page." }],
  },
  {
    version: "1.6.0",
    date: "2026-09-30",
    changes: [{ kind: "improved", text: "Overview shows your investments total in place of the cash flow tile." }],
  },
  {
    version: "1.5.1",
    date: "2026-09-30",
    changes: [{ kind: "improved", text: "Hide amounts now covers only net worth, income, investment totals and account balances. Spending, transactions and budgets stay visible." }],
  },
  {
    version: "1.5.0",
    date: "2026-09-30",
    changes: [{ kind: "improved", text: "Budgets are grouped into one card, with how much is left to spend at the top." }],
  },
  {
    version: "1.4.5",
    date: "2026-09-30",
    changes: [{ kind: "new", text: "Refreshing a single connection shows \"Syncing…\" on its card until it finishes." }],
  },
  {
    version: "1.4.4",
    date: "2026-09-28",
    changes: [{ kind: "fixed", text: "Scrubbing the net worth chart reliably resets when you let go." }],
  },
  {
    version: "1.4.3",
    date: "2026-09-28",
    changes: [{ kind: "improved", text: "The build line shows the exact build you're on." }],
  },
  {
    version: "1.4.2",
    date: "2026-09-28",
    changes: [{ kind: "fixed", text: "The net worth chart no longer stays stuck on a past value after scrubbing." }],
  },
  {
    version: "1.4.1",
    date: "2026-09-28",
    changes: [{ kind: "fixed", text: "The page no longer scrolls while you're scrubbing the net worth chart." }],
  },
  {
    version: "1.4.0",
    date: "2026-09-28",
    changes: [
      { kind: "new", text: "Slide along the net worth chart to see past values." },
      { kind: "new", text: "Search on Transactions, a Sync button, and totals for each institution on Accounts." },
      { kind: "fixed", text: "\"View transactions\" links and Clear all on Transactions work reliably." },
    ],
  },
];
