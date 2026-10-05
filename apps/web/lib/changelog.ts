/**
 * Web's user-facing changelog, newest first -- shown at /settings/changelog,
 * reached only from the small version line at the bottom of Settings (kept
 * deliberately out of the way). Add an entry alongside every APP_VERSION
 * bump in lib/version.ts, written for the person using the app, not as a
 * commit message. Starts at 1.5.2, when the version counter was introduced.
 */
export type ChangeKind = "new" | "improved" | "fixed";

export interface ChangelogEntry {
  version: string;
  date: string; // YYYY-MM-DD
  changes: { kind: ChangeKind; text: string }[];
}

export const CHANGELOG: ChangelogEntry[] = [
  {
    version: "1.17.0",
    date: "2026-10-05",
    changes: [
      { kind: "improved", text: "Accounts redesigned: banks that need you are listed at the top with the reason and a one-click fix, and the rest are sorted below." },
      { kind: "new", text: "Click a bank to open its details: when it last synced, its recent sync history, and its actions in one place." },
      { kind: "improved", text: "Each problem gets its own fix: sign in again, renew access before it runs out, retry when the bank itself is down, or sync now." },
      { kind: "new", text: "The Accounts item in the sidebar shows how many banks need you, so a broken connection is visible from any page." },
      { kind: "improved", text: "Bank cards side by side now always line up at the same height, and long account lists no longer scroll inside the card." },
      { kind: "improved", text: "Alert emails about a broken connection open that bank's details directly." },
      { kind: "fixed", text: "Budgets: a budget you've spent exactly in full no longer turns amber." },
    ],
  },
  {
    version: "1.16.2",
    date: "2026-10-01",
    changes: [
      { kind: "fixed", text: "Large purchase alerts no longer go out for old purchases that show up when your bank sends older history. Only purchases from the past week alert." },
      { kind: "improved", text: "Large purchase and subscription alerts say the date of the charge." },
      { kind: "fixed", text: "The monthly recap's subscriptions total no longer counts subscriptions you removed, and counts prepaid plans spread across months at their monthly share, matching the Subscriptions page." },
      { kind: "improved", text: "Subscription totals only count subscriptions Tally found on its own. Bills you add yourself, like rent, stay in the list but aren't counted." },
    ],
  },
  {
    version: "1.16.1",
    date: "2026-10-01",
    changes: [
      { kind: "fixed", text: "Early retirement: Save assumptions now keeps the expenses and contribution you typed in. Use actual switches back to your real spending." },
    ],
  },
  {
    version: "1.16.0",
    date: "2026-10-01",
    changes: [
      { kind: "improved", text: "Adding a budget, bill, transaction or rule now opens a side panel from a button at the top of the page, so there's no scrolling to find the form." },
      { kind: "improved", text: "Income schedules and API tokens in Settings open in the same side panel." },
      { kind: "improved", text: "Page headers show what you're looking at: the period, counts, and when your accounts last synced. Budgets gets a single month picker." },
      { kind: "new", text: "Transactions leads with how much you've spent in the period you're viewing, and how many transactions are left to review." },
    ],
  },
  {
    version: "1.15.2",
    date: "2026-09-30",
    changes: [{ kind: "improved", text: "Alerts come by email, with one switch per alert in Settings → Alerts." }],
  },
  {
    version: "1.15.1",
    date: "2026-09-30",
    changes: [
      { kind: "improved", text: "Alert emails say what happened, why it matters, and link straight to the right page." },
      { kind: "improved", text: "Recent alerts shows when an alert email didn't go through, and why." },
    ],
  },
  {
    version: "1.15.0",
    date: "2026-09-30",
    changes: [
      { kind: "new", text: "Settings → Alerts: choose which budget, large purchase, subscription and connection alerts to get by email, and set your large purchase amount." },
      { kind: "new", text: "Recent alerts are listed in Settings." },
    ],
  },
  {
    version: "1.14.0",
    date: "2026-09-30",
    changes: [{ kind: "new", text: "Tally emails you when a bank connection needs you to sign in again. Alerts for budgets, large purchases and subscription price changes arrive as phone notifications in an upcoming mobile update." }],
  },
  {
    version: "1.13.5",
    date: "2026-09-30",
    changes: [{ kind: "improved", text: "Cash flow's headline puts your savings rate next to the amount, with the description underneath." }],
  },
  {
    version: "1.13.4",
    date: "2026-09-30",
    changes: [{ kind: "fixed", text: "With amounts hidden, Cash flow still shows your savings rate, and the hidden average no longer leaves a gap before its label." }],
  },
  {
    version: "1.13.3",
    date: "2026-09-30",
    changes: [{ kind: "fixed", text: "Transactions, Budgets and Overview switch to the new month at midnight your time, not hours early in the evening." }],
  },
  {
    version: "1.13.2",
    date: "2026-09-30",
    changes: [{ kind: "improved", text: "Hide amounts and Appearance are now rows at the bottom of the sidebar, styled like the rest of it." }],
  },
  {
    version: "1.13.1",
    date: "2026-09-30",
    changes: [{ kind: "improved", text: "The sidebar footer has labeled Hide amounts and Light/Dark buttons, with Settings and Sign out next to your name." }],
  },
  {
    version: "1.13.0",
    date: "2026-09-30",
    changes: [
      { kind: "improved", text: "Reorganized sidebar: Your money, What you have, What you owe and Plan ahead, each with icons. Credit cards now sit under What you owe." },
      { kind: "new", text: "Rules is in the sidebar." },
      { kind: "improved", text: "The FIRE calculator is now called Early retirement." },
      { kind: "improved", text: "Hide amounts, theme, settings and sign out are one row of buttons at the bottom of the sidebar." },
    ],
  },
  {
    version: "1.12.2",
    date: "2026-09-30",
    changes: [{ kind: "fixed", text: "Canadian ETFs like VFV no longer show up as US dollars (and overvalued) when Plaid reports them under their US over-the-counter listing." }],
  },
  {
    version: "1.12.1",
    date: "2026-09-30",
    changes: [{ kind: "fixed", text: "In light mode, the light green highlight on selected items and the active menu item is visible again." }],
  },
  {
    version: "1.12.0",
    date: "2026-09-30",
    changes: [{ kind: "improved", text: "Refreshed light mode: cards stand out more clearly from the background, borders and focus outlines are easier to see, and gains are a distinct green from buttons and links." }],
  },
  {
    version: "1.11.0",
    date: "2026-09-30",
    changes: [{ kind: "improved", text: "The refined dark mode is now the dark mode: higher-contrast text, clearer card edges and borders. The preview switch in Settings is gone." }],
  },
  {
    version: "1.10.2",
    date: "2026-09-30",
    changes: [{ kind: "improved", text: "Easier-to-scan changelog: versions in a side column, changes grouped by type." }],
  },
  {
    version: "1.10.1",
    date: "2026-09-30",
    changes: [{ kind: "new", text: "This changelog." }],
  },
  {
    version: "1.10.0",
    date: "2026-09-30",
    changes: [
      { kind: "improved", text: "Cash flow chart redesigned: income and spend as two lines with the gap shaded green where you saved and red where you overspent. Side-by-side bars until there are 4 months of history." },
      { kind: "new", text: "Cash flow shows your average saved per month and savings rate, and only covers months you have data for." },
    ],
  },
  {
    version: "1.9.0",
    date: "2026-09-30",
    changes: [
      { kind: "new", text: "Prepaid plans can be spread across 3, 6, 9 or 12 months, starting with the month you paid. Pick the length from a transaction or on Subscriptions." },
      { kind: "fixed", text: "Marking a charge as spread after the fact no longer skips the months that already passed." },
    ],
  },
  {
    version: "1.8.0",
    date: "2026-09-30",
    changes: [
      { kind: "improved", text: "Every budget gets its own color, so similar categories are easy to tell apart in charts." },
      { kind: "improved", text: "The net worth chart on Overview now runs the full width of its card." },
    ],
  },
  {
    version: "1.7.1",
    date: "2026-09-30",
    changes: [{ kind: "improved", text: "Menus, dropdowns, dialogs and chart tooltips sit on their own raised surface in the refined dark mode." }],
  },
  {
    version: "1.7.0",
    date: "2026-09-30",
    changes: [{ kind: "new", text: "Refined dark mode preview: higher-contrast text, clearer card edges and borders. Turn it on in Settings › Appearance." }],
  },
  {
    version: "1.6.1",
    date: "2026-09-30",
    changes: [{ kind: "fixed", text: "Hidden amounts now line up on the right in right-aligned columns." }],
  },
  {
    version: "1.6.0",
    date: "2026-09-30",
    changes: [{ kind: "improved", text: "Overview shows your investments total in place of the cash flow tile." }],
  },
  {
    version: "1.5.10",
    date: "2026-09-30",
    changes: [{ kind: "improved", text: "Hide amounts now covers only net worth, income, investment totals and account balances. Spending, transactions and budgets stay visible." }],
  },
  {
    version: "1.5.9",
    date: "2026-09-30",
    changes: [{ kind: "improved", text: "Amounts that arrive without a currency are treated as CAD." }],
  },
  {
    version: "1.5.8",
    date: "2026-09-30",
    changes: [{ kind: "fixed", text: "Holding currencies stay correct on every future sync, not just the first." }],
  },
  {
    version: "1.5.7",
    date: "2026-09-30",
    changes: [{ kind: "fixed", text: "Portfolio value no longer overstates Canadian-listed ETFs (like VFV) by converting them from USD twice." }],
  },
  {
    version: "1.5.6",
    date: "2026-09-28",
    changes: [{ kind: "improved", text: "The version footer shows the exact build you're on." }],
  },
  {
    version: "1.5.5",
    date: "2026-09-28",
    changes: [{ kind: "fixed", text: "The monthly recap email switch now explains itself on hover." }],
  },
  {
    version: "1.5.4",
    date: "2026-09-28",
    changes: [{ kind: "improved", text: "Cleaner version footer, and a proper Clear button in the Transactions filter bar." }],
  },
  {
    version: "1.5.3",
    date: "2026-09-28",
    changes: [{ kind: "fixed", text: "The version footer is centered and shows its tooltip on hover." }],
  },
  {
    version: "1.5.2",
    date: "2026-09-28",
    changes: [{ kind: "new", text: "The app version now shows in the sidebar footer." }],
  },
];
