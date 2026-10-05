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
