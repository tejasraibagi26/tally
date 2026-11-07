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
    version: "2.19.9",
    date: "2026-11-03",
    changes: [
      { kind: "fixed", text: "A bank that isn't responding no longer shows the \"needs you\" banner after a retry fails. It only shows once the bank has been down a full day, when signing in again is the fix." },
    ],
  },
  {
    version: "2.19.8",
    date: "2026-11-03",
    changes: [
      { kind: "improved", text: "A bank's \"isn't responding\" or \"sign in\" message reads on fewer lines, with its button underneath." },
    ],
  },
  {
    version: "2.19.7",
    date: "2026-11-03",
    changes: [
      { kind: "improved", text: "The \"needs you\" banner only appears when there's something you can fix, like signing in again. A bank that's just having trouble on its side says so on its own card, with Retry." },
    ],
  },
  {
    version: "2.19.6",
    date: "2026-11-03",
    changes: [
      { kind: "improved", text: "The net worth chart's 1M, 3M, 6M and 1Y buttons are outlined, so they're easier to spot." },
    ],
  },
  {
    version: "2.19.5",
    date: "2026-11-02",
    changes: [
      { kind: "fixed", text: "The Light, Dark and Auto buttons in Settings are bigger and easier to tap." },
    ],
  },
  {
    version: "2.19.4",
    date: "2026-11-02",
    changes: [
      { kind: "improved", text: "Category icons now sit on a soft circle in the category's own colour." },
    ],
  },
  {
    version: "2.19.2",
    date: "2026-11-02",
    changes: [
      { kind: "fixed", text: "Switching the net worth chart's range no longer makes the chart jump up." },
    ],
  },
  {
    version: "2.19.1",
    date: "2026-11-02",
    changes: [
      { kind: "improved", text: "Every number now uses Tally's display font, Bricolage Grotesque, in a weight that suits where it sits." },
    ],
  },
  {
    version: "2.19.0",
    date: "2026-11-02",
    changes: [
      { kind: "new", text: "Transactions show their category as an icon in its colour, so you can scan a list at a glance." },
      { kind: "improved", text: "Every number now uses the same font, rounder buttons are back, and text fields have a lighter outline." },
      { kind: "improved", text: "Loans has a proper empty screen, and pop-up explainers no longer blur the screen behind so heavily." },
      { kind: "fixed", text: "Scrubbing a chart on Forecast, Goals or Investments no longer swipes you back a page." },
      { kind: "fixed", text: "Forecast no longer shows a bill as overdue once it has been charged." },
      { kind: "fixed", text: "Retirement shows a full-width loading placeholder instead of one in the middle." },
    ],
  },
  {
    version: "2.18.0",
    date: "2026-11-02",
    changes: [
      { kind: "improved", text: "A calmer look that's easier to read: softer cards without heavy outlines, less rounded corners and quieter colours." },
      { kind: "improved", text: "Your net worth now sits at the top of Overview with a bigger chart that runs edge to edge." },
    ],
  },
  {
    version: "2.17.1",
    date: "2026-11-02",
    changes: [
      { kind: "fixed", text: "Big amounts in Add transaction no longer get cut off: the number shrinks to fit as you type." },
    ],
  },
  {
    version: "2.17.0",
    date: "2026-11-02",
    changes: [
      { kind: "new", text: "A faster Add transaction: type the amount straight away, then tap your usual category and the day. Your most-used categories are right there." },
      { kind: "improved", text: "The button tells you exactly what it'll add, like \"Add expense · $42.50\"." },
    ],
  },
  {
    version: "2.16.4",
    date: "2026-11-02",
    changes: [
      { kind: "fixed", text: "Adding a transaction, bill or income schedule no longer picks an account for you. You choose it, so nothing lands in the wrong account." },
    ],
  },
  {
    version: "2.16.3",
    date: "2026-11-02",
    changes: [
      { kind: "improved", text: "A transaction's details open in the same frosted, floating sheet as everything else." },
    ],
  },
  {
    version: "2.16.2",
    date: "2026-11-02",
    changes: [
      { kind: "improved", text: "Every sheet now has the same frosted look: see-through, but calm and easy to read whatever is behind it." },
      { kind: "improved", text: "The More sheet's cards sit on the glass, and its title lines up on the left." },
    ],
  },
  {
    version: "2.16.1",
    date: "2026-11-02",
    changes: [
      { kind: "improved", text: "Sheets, More included, are see-through on iPhone: what's behind them softly blurs through." },
      { kind: "fixed", text: "The More sheet's bottom corners are no longer cut off by the screen's rounded corners." },
    ],
  },
  {
    version: "2.16.0",
    date: "2026-11-02",
    changes: [
      { kind: "improved", text: "Sheets now float as rounded cards, set in from the edges of the screen." },
    ],
  },
  {
    version: "2.15.3",
    date: "2026-11-02",
    changes: [
      { kind: "fixed", text: "In Add transaction, the date, category and account look like fields you can tap, matching the rest of the form." },
    ],
  },
  {
    version: "2.15.2",
    date: "2026-11-02",
    changes: [
      { kind: "fixed", text: "In a budget, \"See transactions\" shows its full label instead of being cut off." },
    ],
  },
  {
    version: "2.15.1",
    date: "2026-11-01",
    changes: [
      { kind: "improved", text: "Goals has a fresh layout: your goal and its pace come first, and changing or removing the target lives in one tidy place." },
      { kind: "improved", text: "The retirement sliders now match Tally's colours, and dragging one no longer scrolls the page." },
    ],
  },
  {
    version: "2.15.0",
    date: "2026-11-01",
    changes: [
      { kind: "improved", text: "Dark mode is darker: deeper, near-black backgrounds and cards, so it's easier on your eyes at night." },
    ],
  },
  {
    version: "2.14.1",
    date: "2026-11-01",
    changes: [
      { kind: "improved", text: "Screens show a placeholder of what's coming while they load, instead of a spinner." },
      { kind: "fixed", text: "Buttons that are busy keep their label and size, and look the same everywhere." },
      { kind: "fixed", text: "The \"Last month\" filter and Year in review use your own date, not UTC, so they're right late in the evening." },
    ],
  },
  {
    version: "2.14.0",
    date: "2026-11-01",
    changes: [{ kind: "improved", text: "Dark mode pops like light mode: bold outlines, a grape shadow under every card, and a solid grape net worth card." }],
  },
  {
    version: "2.13.7",
    date: "2026-11-01",
    changes: [{ kind: "fixed", text: "Overview no longer opens in your phone's theme before switching to the appearance you chose." }],
  },
  {
    version: "2.13.6",
    date: "2026-11-01",
    changes: [{ kind: "fixed", text: "Tally opens straight in the appearance you chose, instead of flashing your phone's theme first." }],
  },
  {
    version: "2.13.5",
    date: "2026-11-01",
    changes: [{ kind: "fixed", text: "On the first of the month, On-pace days says \"New month\" instead of blaming yesterday." }],
  },
  {
    version: "2.13.4",
    date: "2026-10-31",
    changes: [{ kind: "fixed", text: "You can stay signed in on your iPhone and Android phone at the same time." }],
  },
  {
    version: "2.13.3",
    date: "2026-10-31",
    changes: [{ kind: "improved", text: "This month on Overview is one card: spending, income and savings, with investments and credit used at the bottom." }],
  },
  {
    version: "2.13.2",
    date: "2026-10-31",
    changes: [{ kind: "fixed", text: "This month no longer resets to $0 in the evening on the last day of the month." }],
  },
  {
    version: "2.13.1",
    date: "2026-10-31",
    changes: [{ kind: "fixed", text: "On Android, cards now have the same offset shadow as on iPhone." }],
  },
  {
    version: "2.13.0",
    date: "2026-10-31",
    changes: [
      { kind: "new", text: "Loans, in the More menu: every mortgage, student, car and personal loan and line of credit, with the rate and next payment when your lender shares them." },
      { kind: "improved", text: "Loan payments now come out of Forecast and Safe to spend." },
    ],
  },
  {
    version: "2.12.0",
    date: "2026-10-31",
    changes: [{ kind: "improved", text: "Your year-end goal and early retirement plan now live together under Goals in the More menu, a tab each." }],
  },
  {
    version: "2.11.0",
    date: "2026-10-31",
    changes: [
      { kind: "improved", text: "Forecast is now the one place for what's ahead: Safe to spend at the top, then where your balance lands, then every bill, card payment and payday." },
      { kind: "improved", text: "Upcoming moved into Forecast. Open Safe to spend on Overview to get there." },
      { kind: "fixed", text: "Forecast alert emails open Forecast in the app, not Overview." },
    ],
  },
  {
    version: "2.10.0",
    date: "2026-10-31",
    changes: [
      { kind: "improved", text: "Tally has one look now. The classic look and the \"New look\" switch in Settings are gone." },
      { kind: "new", text: "Year-end goal, Safe to spend and their alerts are available to everyone." },
    ],
  },
  {
    version: "2.9.2",
    date: "2026-10-31",
    changes: [{ kind: "improved", text: "Safe to spend labels its bar: bills, card payments and your cushion, with what each takes, then what's safe." }],
  },
  {
    version: "2.9.1",
    date: "2026-10-31",
    changes: [
      { kind: "fixed", text: "When your session ends (a password change, or signing out everywhere), the app goes straight to sign-in instead of hanging on Overview." },
      { kind: "fixed", text: "A wrong password at sign-in says so, instead of \"Session expired\"." },
      { kind: "fixed", text: "Losing signal for a moment no longer signs you out." },
    ],
  },
  {
    version: "2.9.0",
    date: "2026-10-31",
    changes: [
      { kind: "improved", text: "Changing your password signs you out everywhere, this phone included, so you sign in again with the new one." },
      { kind: "improved", text: "Changing your email sends a link to the new address; it changes once you tap it." },
    ],
  },
  {
    version: "2.8.5",
    date: "2026-10-30",
    changes: [{ kind: "fixed", text: "The opening animation's fifth stroke is marigold in light mode again, not dark." }],
  },
  {
    version: "2.8.4",
    date: "2026-10-30",
    changes: [{ kind: "fixed", text: "Forecast: the page no longer scrolls up behind its title and back button." }],
  },
  {
    version: "2.8.3",
    date: "2026-10-30",
    changes: [{ kind: "improved", text: "Forecast: What's coming matches the web. One block per day, the balance that day leaves you, and a clear flag when it's under your buffer. Tap a row to open the bill, card or paycheque behind it." }],
  },
  {
    version: "2.8.2",
    date: "2026-10-30",
    changes: [{ kind: "fixed", text: "Android: the Budgets tab uses the same pie chart icon as iPhone." }],
  },
  {
    version: "2.8.1",
    date: "2026-10-30",
    changes: [
      { kind: "fixed", text: "Android: the tab bar no longer blends into the cards behind it in dark mode, and the screen fades out beneath it." },
      { kind: "improved", text: "Forecast: press and drag the chart to read any day's balance and what comes out that day. What's coming now shows everything, not just the first twelve." },
      { kind: "fixed", text: "Forecast, Safe to spend and Upcoming now count every subscription you see in Subscriptions, including new ones and ones running a few days late." },
    ],
  },
  {
    version: "2.8.0",
    date: "2026-10-28",
    changes: [
      { kind: "new", text: "Forecast: where your balance is heading for the next 60 days, from your pay dates, bills and card statements. It leads with the first day you'd drop below your buffer and what put you there, under Forecast in the More menu." },
    ],
  },
  {
    version: "2.7.3",
    date: "2026-10-28",
    changes: [{ kind: "improved", text: "The Tags screen with no tags yet looks like the web app's." }],
  },
  {
    version: "2.7.2",
    date: "2026-10-28",
    changes: [{ kind: "improved", text: "Year in review moved out of the More menu; it shows at the top of Overview in January." }],
  },
  {
    version: "2.7.1",
    date: "2026-10-28",
    changes: [{ kind: "improved", text: "Year in review covers whole years: it appears in January for the year that just ended, and past years stay a tap away." }],
  },
  {
    version: "2.7.0",
    date: "2026-10-28",
    changes: [
      { kind: "new", text: "Your year in review is one tap away, at the top of Overview." },
      { kind: "new", text: "Buttons in Tally's emails open the app on your phone, on the right screen." },
    ],
  },
  {
    version: "2.6.0",
    date: "2026-10-28",
    changes: [
      { kind: "new", text: "Tags, under More: add up a trip, an event or a project across categories, with its total, cost per day and breakdown." },
      { kind: "improved", text: "Tap a tag on a transaction to see everything with that tag; its × removes it." },
    ],
  },
  {
    version: "2.5.0",
    date: "2026-10-28",
    changes: [{ kind: "new", text: "Year in review, under More: how far your net worth moved, what came in and went out, your top categories and places, and the months that stood out." }],
  },
  {
    version: "2.4.5",
    date: "2026-10-28",
    changes: [{ kind: "improved", text: "A card's payment due day is picked from a calendar grid, like on the web." }],
  },
  {
    version: "2.4.4",
    date: "2026-10-28",
    changes: [{ kind: "improved", text: "A card's payment due day is picked as a day of the month, and says what it's for, instead of a box that took any number." }],
  },
  {
    version: "2.4.3",
    date: "2026-10-28",
    changes: [{ kind: "fixed", text: "Settings → Income shows your next payday instead of 0 when Tally has found your paycheque." }],
  },
  {
    version: "2.4.2",
    date: "2026-10-28",
    changes: [{ kind: "improved", text: "Settings → Income shows your next paycheque, like the web app, above your income schedules." }],
  },
  {
    version: "2.4.1",
    date: "2026-10-28",
    changes: [{ kind: "fixed", text: "Safe to spend's breakdown sits on a proper card, and the cushion no longer shows a double minus." }],
  },
  {
    version: "2.4.0",
    date: "2026-10-28",
    changes: [
      { kind: "new", text: "Safe to spend on Overview: the cash you can spend before your next paycheque without missing a bill or a card payment. Tap it for the breakdown." },
      { kind: "new", text: "Settings → Safe to spend: your next paycheque, which accounts count, a cushion, and due days for cards your bank doesn't report." },
      { kind: "new", text: "An email when safe to spend drops below an amount you choose, set in Alerts." },
      { kind: "fixed", text: "In dark mode, cards show their sticker edge again instead of fading into the background." },
    ],
  },
  {
    version: "2.3.10",
    date: "2026-10-28",
    changes: [{ kind: "fixed", text: "\"Always use\" now works for transactions with no merchant name, like paycheques: it remembers your category for deposits that look the same, even when the reference number changes." }],
  },
  {
    version: "2.3.9",
    date: "2026-10-28",
    changes: [{ kind: "improved", text: "Transactions' header no longer has the \"Your money\" label above its title." }],
  },
  {
    version: "2.3.8",
    date: "2026-10-28",
    changes: [
      { kind: "fixed", text: "Charts that run edge to edge of their card now stop at its outline instead of drawing over it." },
      { kind: "fixed", text: "Where it went's bar shows its last category at its real size instead of cutting it short." },
    ],
  },
  {
    version: "2.3.7",
    date: "2026-10-28",
    changes: [{ kind: "fixed", text: "A dialog's title now lines up with the icon beside it instead of sitting at its top edge." }],
  },
  {
    version: "2.3.6",
    date: "2026-10-28",
    changes: [{ kind: "improved", text: "Removing your goal, a budget, a split or a card limit you entered now asks first, so a stray tap can't remove it." }],
  },
  {
    version: "2.3.5",
    date: "2026-10-28",
    changes: [{ kind: "fixed", text: "Tapping the goal card on the Goals screen no longer opens the same screen again on top of itself." }],
  },
  {
    version: "2.3.4",
    date: "2026-10-27",
    changes: [{ kind: "fixed", text: "Switches in Settings and elsewhere sit centered in their rows again." }],
  },
  {
    version: "2.3.3",
    date: "2026-10-27",
    changes: [{ kind: "new", text: "A How it works button on the Goals page explains your pace, the projection, and what Tally suggests when you're behind." }],
  },
  {
    version: "2.3.2",
    date: "2026-10-27",
    changes: [{ kind: "fixed", text: "The second button in pop-ups now has a clear outline in dark mode." }],
  },
  {
    version: "2.3.1",
    date: "2026-10-27",
    changes: [{ kind: "new", text: "A quick hello to the new look the first time you open Overview, with a one-tap way back to the classic one." }],
  },
  {
    version: "2.3.0",
    date: "2026-10-27",
    changes: [
      { kind: "new", text: "Tally has a new look: brighter colors, new type, charts that run edge to edge, and a new icon. Prefer the old one? Turn off New look in Settings." },
      { kind: "new", text: "Year-end goals: pick a net worth to reach by Dec 31 and Tally projects where your pace lands and whether you're on track. Find it on Overview." },
    ],
  },
  {
    version: "2.2.4",
    date: "2026-10-27",
    changes: [{ kind: "improved", text: "More polish on the new look we're trying out." }],
  },
  {
    version: "2.2.3",
    date: "2026-10-27",
    changes: [{ kind: "improved", text: "More polish on the new look we're trying out." }],
  },
  {
    version: "2.2.2",
    date: "2026-10-27",
    changes: [{ kind: "improved", text: "More polish on the new look we're trying out." }],
  },
  {
    version: "2.2.1",
    date: "2026-10-27",
    changes: [{ kind: "improved", text: "More polish on the new look we're trying out." }],
  },
  {
    version: "2.2.0",
    date: "2026-10-27",
    changes: [{ kind: "improved", text: "On iPhone, dialogs blur the screen behind them on every iOS version." }],
  },
  {
    version: "2.1.3",
    date: "2026-10-27",
    changes: [{ kind: "improved", text: "More polish on the new look we're trying out." }],
  },
  {
    version: "2.1.2",
    date: "2026-10-27",
    changes: [{ kind: "improved", text: "More groundwork for a feature we're trying out with the new look." }],
  },
  {
    version: "2.1.1",
    date: "2026-10-27",
    changes: [{ kind: "improved", text: "On iPhone, dialogs now blur the screen behind them, so what they ask is easier to focus on." }],
  },
  {
    version: "2.1.0",
    date: "2026-10-27",
    changes: [{ kind: "improved", text: "Groundwork for a new feature we're trying out with the new look. Nothing changes for you yet." }],
  },
  {
    version: "2.0.0",
    date: "2026-10-26",
    changes: [{ kind: "improved", text: "Groundwork for a new look we're trying out. Nothing changes for you yet." }],
  },
  {
    version: "1.32.0",
    date: "2026-10-17",
    changes: [
      { kind: "new", text: "Rename a merchant: tap its name on a transaction. The new name covers every transaction from that merchant, including future ones." },
      { kind: "fixed", text: "When Plaid matches a charge to an unrelated merchant (\"SONNET INSURANCE\" showing as \"Child Net\"), the bank's own description is shown instead, without the wrong logo." },
    ],
  },
  {
    version: "1.31.1",
    date: "2026-10-09",
    changes: [{ kind: "fixed", text: "Android: a bank's card could show up blank on Accounts right after signing back in to it." }],
  },
  {
    version: "1.31.0",
    date: "2026-10-07",
    changes: [
      { kind: "improved", text: "Adding a budget or transaction, editing a budget and dismissing a bill keep their button label while they work, and explain any problem with an icon." },
      { kind: "improved", text: "Buttons on bank cards, Add in the top corner, Sync, Try again and Log in no longer swap their label for a spinner or change size." },
      { kind: "fixed", text: "The spinner on add buttons is no longer white on the light theme." },
    ],
  },
  {
    version: "1.30.2",
    date: "2026-10-07",
    changes: [{ kind: "new", text: "Credit cards has a Sync button, which pulls the latest balances, statements and due dates from your banks." }],
  },
  {
    version: "1.30.1",
    date: "2026-10-07",
    changes: [{ kind: "fixed", text: "Sync, Add and Reconnect buttons stay the same size while they're working." }],
  },
  {
    version: "1.30.0",
    date: "2026-10-07",
    changes: [
      { kind: "improved", text: "Disconnecting a bank now keeps its history: past transactions still count in spending and budgets. Only its balances leave your net worth." },
      { kind: "new", text: "Disconnected banks are listed on Accounts with a Reconnect button. Reconnecting picks up where you left off, keeping your categories, splits and notes without doubling anything." },
    ],
  },
  {
    version: "1.29.0",
    date: "2026-10-07",
    changes: [
      { kind: "improved", text: "Settings redesigned as a simple list: your profile on top, then preferences, notifications, data and account." },
      { kind: "improved", text: "Editing your profile and changing your password open in their own sheet, with any problem shown right there instead of a pop-up." },
      { kind: "improved", text: "Wiping your data asks for your password in one step, and tells you in place if it's wrong." },
      { kind: "improved", text: "Exporting asks CSV or JSON in a sheet that says what each is for." },
    ],
  },
  {
    version: "1.28.0",
    date: "2026-10-07",
    changes: [
      { kind: "improved", text: "Connecting or reconnecting a bank now shows which bank, what Tally is pulling in, and how it went, including anything that didn't come through." },
      { kind: "improved", text: "If a bank is slow to respond, Tally tells you it's taking longer than usual instead of looking stuck." },
      { kind: "improved", text: "Connection errors are in plain language now, with a button to try again." },
      { kind: "improved", text: "Revoking a connection lists the exact accounts that will be deleted, and a failed revoke now says so." },
      { kind: "improved", text: "A sync problem on Transactions stays on screen as a banner instead of a pop-up." },
    ],
  },
  {
    version: "1.27.3",
    date: "2026-10-07",
    changes: [{ kind: "fixed", text: "iPhone: in Dark Mode, the back button and top bar now look dark like other apps, instead of light." }],
  },
  {
    version: "1.27.2",
    date: "2026-10-05",
    changes: [{ kind: "fixed", text: "Credit cards: a card's last four digits no longer overlap the Visa, Mastercard or Amex mark." }],
  },
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
