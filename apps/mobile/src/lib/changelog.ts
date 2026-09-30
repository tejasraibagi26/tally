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
