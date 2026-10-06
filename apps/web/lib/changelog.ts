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
    version: "1.23.0",
    date: "2026-10-05",
    changes: [
      { kind: "improved", text: "Editing a transaction is redesigned: the category comes first, with who set it and up to three suggestions one click away." },
      { kind: "improved", text: "Changes save as you make them, with Undo. No more Save and Cancel." },
      { kind: "new", text: "Spreading a prepaid plan now shows the monthly amount before you confirm, and you can change the term or stop it later." },
      { kind: "improved", text: "Splits must add up before they save, with \"Split evenly\" and \"Put the rest in\" to get there fast." },
      { kind: "new", text: "Press j and k to move between transactions without closing the panel, and share a link straight to one." },
      { kind: "fixed", text: "Deleting a transaction you added now asks first." },
    ],
  },
  {
    version: "1.22.0",
    date: "2026-10-05",
    changes: [
      { kind: "improved", text: "Overview: a bill that's past due stays at the top of Upcoming for a few days, marked Overdue, instead of disappearing." },
      { kind: "fixed", text: "A card payment whose bank doesn't report a minimum now says \"Min. unknown\" instead of $0.00." },
    ],
  },
  {
    version: "1.21.2",
    date: "2026-10-05",
    changes: [{ kind: "fixed", text: "Subscriptions: editing a bill's next date now opens in a dialog in the middle of the screen, so you no longer have to scroll the table to reach Save." }],
  },
  {
    version: "1.21.1",
    date: "2026-10-05",
    changes: [{ kind: "improved", text: "Budgets: fixed budgets like rent are marked with a clear \"Fixed\" tag." }],
  },
  {
    version: "1.21.0",
    date: "2026-10-05",
    changes: [
      { kind: "improved", text: "Early retirement redesigned: it leads with the age and year you could retire, with a clearer chart showing when you reach your target." },
      { kind: "new", text: "See what each change is worth in years (save $250 more a month, spend less, different returns) and the milestones on the way, like Coast FIRE." },
      { kind: "improved", text: "The plan now accounts for inflation, so the date is in today's dollars and no longer comes out a few years too early." },
      { kind: "fixed", text: "Accounts in US dollars are converted to CAD before they count toward what you've invested. You can also leave accounts out, like an FHSA saved for a house." },
      { kind: "improved", text: "Changes save as you go. No more Save button." },
    ],
  },
  {
    version: "1.20.0",
    date: "2026-10-05",
    changes: [
      { kind: "new", text: "Transactions: \"Review\" walks you through new transactions one at a time. Press Enter to confirm the category, or pick another. You can tell Tally to always use your pick for that merchant." },
      { kind: "improved", text: "Transactions are grouped by day with each day's total, and each one shows a single clear status (pending, refund, transfer, split…)." },
      { kind: "new", text: "Click a category on any row to change it right there, and see whether a rule, you, or Tally set it." },
      { kind: "new", text: "Select several transactions to categorize, review or exclude them together. Keyboard: j/k to move, x to select, c for category, e to mark reviewed, / to search." },
    ],
  },
  {
    version: "1.19.0",
    date: "2026-10-05",
    changes: [
      { kind: "improved", text: "Budgets redesigned: see what's left to spend and about how much that is per day, with budgets grouped like your categories." },
      { kind: "new", text: "Each budget bar marks where you'd be at an even pace, and warns when you're on pace to go over." },
      { kind: "new", text: "Spending in categories without a budget now shows as \"Not budgeted\", so the month adds up." },
      { kind: "new", text: "Set up a new month in one click: copy last month, or use your 3-month averages." },
      { kind: "improved", text: "Click a budget to see 6 months of history, change it, or remove it (with undo)." },
    ],
  },
  {
    version: "1.18.0",
    date: "2026-10-05",
    changes: [
      { kind: "new", text: "Investments: a chart of your portfolio over time, with the money you put in drawn underneath so you can see your growth. Switch between 1 month and all time." },
      { kind: "improved", text: "Two plain numbers, Invested and Growth, replace the old return tiles." },
      { kind: "improved", text: "Holdings are one list across all your accounts, with the gain on each position. Sort by any column or filter to one account." },
      { kind: "new", text: "Click a holding to see what you paid, how it's split across accounts, and its activity." },
      { kind: "improved", text: "Activity reads plainly (\"Bought 12 XEQT\", \"Dividend from VFV\"), with filters and your income and contributions this year." },
      { kind: "improved", text: "If a brokerage connection needs you, Investments says which holdings are out of date and offers the fix." },
    ],
  },
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
