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
