# MOBILE_DESIGN.md — Spec Sheet: "Tally" Mobile (Android-first)

The native-app companion to `DESIGN.md`. This is not a port of `DESIGN.md §10`'s
"Mobile (390)" section — that section is about *responsive web breakpoints* for
the Next.js app. This document specs a real React Native (Expo) app: its own
navigation, its own component idioms, built from the exact same tokens.

Same design direction as the web app: **a quiet, editorial ledger** — warm paper
neutrals, one deep evergreen accent, serif hero numbers, calm and non-gamified.
Nothing here invents a new visual language; it translates `DESIGN.md`'s system
into native primitives (bottom sheets instead of side panels, card lists instead
of tables, tab bars instead of a left nav).

---

## 1. Platform posture

- **Android-first.** Every spec below assumes Android's Material-adjacent
  conventions where they don't conflict with the brand (system back gesture,
  bottom sheets, ripple feedback) — but nothing here is Android-*only*. Build
  against `expo-router` + NativeWind + React Native primitives so the same code
  runs on iOS later; iOS-specific adjustments (safe-area insets, swipe-back,
  haptics) are called out inline, not treated as a separate spec.
- **Distribution:** sideloaded APK (see the implementation plan's Phase 6) — no
  Play Store chrome/requirements to design around (no Play listing screenshots,
  no in-app review prompts).
- **Orientation:** portrait-only for v1. No tablet layout in scope.

---

## 2. Navigation & information architecture

**Bottom tab bar — 4 tabs, matching `DESIGN.md §10`'s existing mobile-web note:**

```
┌─────────┬─────────────┬─────────┬─────────┐
│ Overview│ Transactions│ Budgets │ Accounts│
│   ⌂     │      ≡      │    ◔    │    🏦   │
└─────────┴─────────────┴─────────┴─────────┘
```

- Height 56 (+ safe-area bottom inset). Active tab: icon + label in `--brand`;
  inactive: `--text-3`, icon only shrinks visual weight, not size (min 24px
  icon, per accessibility touch-target rules below).
- No hamburger menu, no drawer. Subscriptions, Investments, FIRE calculator,
  and Settings live behind an **"More"** entry point — for v1, reachable as a
  header action (top-right icon) on the Overview tab rather than a 5th tab,
  since rollout phases C/D/F ship after A/B and shouldn't force a 5-tab bar
  redesign later. Revisit as a real 5th tab once Investments ships.
- **Stack navigation** nests inside each tab (`expo-router`'s `(tabs)/*/`
  groups): Transactions → transaction detail; Accounts → account detail /
  reconnect flow; Budgets → category detail. Back via native back
  gesture/button, not an in-app back arrow duplicated in the header (header
  keeps only a title + contextual right action).
- **Modals vs. sheets:** anything the web app renders as a 420px side panel
  (`DESIGN.md §8` "Side panel") becomes a **bottom sheet** on mobile (transaction
  detail/edit, quick-categorize, filter builder). Anything the web app renders
  as a centered modal (Plaid Link, confirm dialogs) stays a **centered modal**
  on mobile too — don't sheet-ify a confirm dialog.

---

## 3. Token translation (NativeWind config)

Values are **identical** to `DESIGN.md §5/§14`, restated as plain values
because NativeWind cannot read CSS custom properties at runtime the way web
Tailwind does. This block is the literal source `packages/core`'s token module
should export (see the implementation plan's Phase 3) — do not hand-copy hex
values into components; import from the shared module.

### 3.1 Color — light

| Token | Hex |
|---|---|
| canvas | `#F1F0EC` |
| surface | `#FFFFFF` |
| surface-2 | `#F8F8F5` |
| sunken | `#ECEBE6` |
| border | `#E3E1DB` |
| border-strong | `#8A877E` |
| text | `#1A1917` |
| text-2 | `#4D4B45` |
| text-3 | `#65635C` |
| brand | `#14513F` |
| brand-hover (→ pressed state) | `#0E3E30` |
| brand-subtle | `#D0E3D9` |
| brand-border | `#A9C8B9` |
| on-brand | `#FFFFFF` |
| positive | `#237A3B` |
| negative | `#B3372A` |
| warning | `#835600` |
| info | `#2466C6` |

### 3.2 Color — dark

| Token | Hex |
|---|---|
| canvas | `#111110` |
| surface | `#1A1A19` |
| surface-2 | `#232320` |
| sunken | `#0C0C0B` |
| border | `#2B2B28` |
| border-strong | `#3D3D38` |
| text | `#F2F1ED` |
| text-2 | `#A8A69D` |
| text-3 | `#77756D` |
| brand | `#4FB394` |
| brand-hover | `#6AC5A9` |
| brand-subtle | `#14251F` |
| brand-border | `#234438` |
| on-brand | `#0C1A15` |
| positive | `#4FC49B` |
| negative | `#F0846B` |
| warning | `#E0A94A` |
| info | `#3987E5` |

Status colors (`good #0CA30C`, `warning #FAB219`, `serious #EC835A`,
`critical #D03B3B`) and the 8-slot chart series palette are **fixed in both
themes**, unchanged from `DESIGN.md §5.3/§7.1` — copy verbatim, never re-derive.

RN theme switching: follow system `Appearance` API by default (`useColorScheme`
from `react-native`), same as the web app's `prefers-color-scheme` default —
no manual light/dark toggle needed for v1 unless the web app gets one first.

### 3.3 Type

RN can't use CSS `font-family` fallback stacks — bundle the three fonts as
actual font assets via `expo-font`/`useFonts`:

| Role | Family | Size / line height | Weight | RN usage |
|---|---|---|---|---|
| display-l | Instrument Serif | 40 / 1.06 | 400 | Screen hero numbers (net worth, portfolio value) |
| display-m | Instrument Serif | 32 / 1.1 | 400 | Panel hero numbers (stat tile figures) |
| h1 | Inter | 22 / 1.25 | 600 | Screen title (header) — reduced from web's 24 to fit mobile header height |
| h2 | Inter | 18 / 1.3 | 600 | Section/card title |
| h3 | Inter | 15 / 1.4 | 600 | List group header |
| body | Inter | 15 / 1.5 | 400 | Default |
| body-strong | Inter | 15 / 1.5 | 500 | Card-list primary line (merchant name) |
| small | Inter | 13 / 1.45 | 400 | Secondary metadata |
| label | Inter | 11 / 1.2 | 500 | Uppercase, 0.06em tracking, `text-2` |
| mono | JetBrains Mono | 12 / 1.4 | 400 | Account masks, tickers |

**Numeral rules unchanged from `DESIGN.md §4`:** all numeric text uses tabular
figures. RN's `Inter`/`JetBrains Mono` font files must be the variants with
`tnum` enabled by default, or apply `fontVariant: ["tabular-nums"]` explicitly
on every `Text` node rendering a number — there is no CSS-cascade equivalent of
web's blanket `.tabular` class, so this has to be a shared `<MoneyText>` /
`<TabularText>` component used everywhere a number renders, not an ambient
style.

### 3.4 Spacing, radius, elevation

**Visual texture is intentionally softer than the web app** — closer to
Wealthsimple's app language than `DESIGN.md`'s hairline-and-shadow-barely-there
treatment, while keeping every actual token (colors, brand accent, serif hero
numbers) identical. Concretely:

- **Cards drop the visible `--border` hairline and separate from `--canvas`
  with shadow alone**: `0 2px 12px -2px rgba(26,25,23,.07)` at rest (Android
  `elevation` equivalent ≈ 2). This replaces `DESIGN.md §6`'s "hairlines
  first, shadow second" rule for mobile specifically — mobile cards read as
  soft, floating surfaces, not bordered boxes.
- **Larger radii than web**: 16 (controls/inputs, up from 8), 18 (cards, up
  from 12), 999 (pills, unchanged). Bigger radii read as friendlier/more
  native-app than the web's tighter, more editorial corners.
- **More generous spacing**: page padding 20 (up from the 16 in §3.4's
  original web-parity draft), section gaps 24-28 (vs. web's 16-24), stat-tile
  and card internal padding 18-20. Whitespace does more of the separating
  work that hairlines used to do.
- **Hero net-worth figure sits directly on `--canvas`**, no card container —
  the single biggest number on the screen shouldn't be boxed in.
- **Stat tiles get a soft tint background** (one of the existing
  `*-subtle` tokens — `negative-subtle`, `positive-subtle`, `brand-subtle`,
  `info-subtle` — already defined in `app/globals.css`, rotated per tile by
  meaning: spend → negative-subtle, income → positive-subtle, cash flow →
  brand-subtle, credit utilization → info-subtle) instead of a plain
  white-with-border card. This is the one place mobile explicitly reaches for
  a categorical color treatment the web app doesn't use at this density —
  still drawing only from existing tokens, never a new hue.
- **List rows inside a card**: dividers, where kept (transaction list,
  account rows), lighten from `--border` at full opacity to ~55% (`rgba(228,
  225, 217, .55)` in light) and get taller row padding (16 vs. web's tighter
  44px table row) — separation comes from air first, a faint line second.
- **Tab bar and primary buttons**: tab bar drops its top border for a soft
  upward shadow (`0 -4px 16px -4px rgba(26,25,23,.08)`); the primary CTA
  button becomes a full pill (radius 999, up from 8) with its own soft brand-
  tinted shadow (`0 8px 20px -6px rgba(20,81,63,.45)`) rather than a flat
  filled rectangle.

Elevation mechanics: RN has no `box-shadow` — use `elevation` (Android) /
`shadowColor`+`shadowOpacity`+`shadowRadius` (iOS, ignored on Android) tuned
to match the values above. Dark mode still drops/reduces the shadow and
raises `surface-2` a step, same rule as web (`DESIGN.md §6`), just calibrated
against mobile's stronger resting shadow rather than web's barely-there one.

---

## 4. Accessibility & touch (Android-specific additions to `DESIGN.md §12`)

- Touch targets ≥ 44×44 (already a `DESIGN.md` rule — restated because it's
  load-bearing on mobile: tab bar icons, category-pill tap area, row
  swipe-actions, checkbox in bulk-select).
- Support Android's font-scale accessibility setting — layouts must reflow, not
  clip, up to at least 130% system font scale (mobile equivalent of the web
  spec's "200% zoom must not clip" rule, scaled to what Android actually
  exposes).
- `accessibilityLabel`/`accessibilityRole` on every icon-only control (tab bar
  items already have visible labels; icon-only header actions and swipe
  actions need explicit labels).
- Respect the OS "reduce motion" accessibility setting the same way `DESIGN.md
  §11` respects `prefers-reduced-motion` — check
  `AccessibilityInfo.isReduceMotionEnabled()` and skip sheet/transition
  animation, not just shorten it.
- Status meaning still never carried by color alone — icon + label pairing
  from `DESIGN.md §5.3` applies unchanged (freshness badges, budget
  over/under, connection health).

---

## 5. Screen specs (rollout phases A–D, per the implementation plan)

### 5.1 Login (Phase A)

- Centered form: Tally mark, email field, password field, primary button
  ("Log in"), no sign-up flow (single-user personal app — confirm this
  assumption if it changes). Error state: inline message under the field
  in `--negative` with an icon, not a toast (matches `DESIGN.md`'s input
  error spec).
- No "remember me" toggle — tokens persist by default via `expo-secure-store`
  until explicit logout, matching how the web app's session cookie already
  behaves.

### 5.2 Overview (Phase B, condensed from `DESIGN.md §10.1`; redesigned in app 1.21.0)

Single scrolling column, in this order. Pure rules (due labels, budget ranking,
net-worth range and delta, credit band) live in `@tally/core/overviewView`.
1. **Net worth hero** — unboxed on the canvas. serif figure at 68pt (this screen scales
   `display-l` up) with the cents at 32pt in `text-3`; a delta chip (arrow, signed amount,
   %, with the range as its caption); the full-bleed 112pt trend chart you can
   scrub, with a dot on today (or the scrubbed day) drawn by the chart; a
   1M / 3M / 6M / 1Y range control (default 1M) that slices the
   already-loaded 12-month daily series. Privacy on: the chip keeps its % and
   hides its amount.
2. **Needs you** — renders only when something needs a tap, otherwise takes no
   space (sync freshness lives in the header meta line). A tinted card
   (`negative-subtle` if any bank is blocked, else `warning-subtle`) with
   icon + "N banks need you", the balances affected, and up to two bank rows
   each with its reason and the tone-colored action pill; every tap opens the
   Accounts tab's Fix sheet. Beneath it, a solid `brand` "N transactions to
   review" bar into the review queue. The count is this month's, read from the
   Transactions list's default summary, so it always equals the Transactions
   tab's "N to review" banner; the queue opens with `?scope=month`, so older
   months' backlog is ignored there too.
3. **This month** — one card: Spent (serif 32) against the month's total
   budget with the budget-row meter (no tick, projection or pace verdict),
   then Income and Saved
   (income − spend), labelled "Saved so far" and kept in plain text when
   negative mid-month. Income and Saved mask with the privacy toggle.
   No budget: "Set a budget" link instead of the meter.
4. **Investments / Credit used** — one card under This month with a hairline
   between the two figures; one alone fills the card, none renders nothing;
   stacks on narrow or large-text screens. Credit reads "Healthy" under 30% of the limit, "High" at or over,
   shows "balance of limit" (hidden with the privacy toggle) and notes any card
   left out for having no limit, and "1 card is high" when the total is
   healthy but a single card is at or over 30%. Overpaid cards count as zero used and
   cards in different currencies are converted before summing.
5. **Budget this month** — the three most-used budgets (over-budget first;
   paid fixed-amount budgets skipped) as meter rows, "View all" → Budgets tab.
6. **Upcoming** — next 3 bills with a date tile, a due label ("Due today",
   "tomorrow", "in 3 days") and the amount; "View all" only when more exist.
   Only spending is listed (never a detected paycheck, bonus or refund), a
   dismissed bill stays gone, and a guessed bill must clear a confidence bar
   (`qualifiesAsUpcoming`); card payments and bills you added or dated
   yourself always count. A bill Tally guessed shows a "⋯" and opens a sheet
   with "This won't recur", which dismisses the stream behind it. "View all"
   (always shown when there are bills) opens the Upcoming screen: every bill in the window, card payments
   included, grouped Overdue / This week / Later. A bill stays listed 3 days
   past due, first and marked "Overdue · 2 days" (a card only when the bank
   flags it); a card with no reported minimum reads "Min. unknown" with its
   statement balance. "This won't recur" offers Undo for 5 seconds, and
   Subscriptions keeps a collapsed Dismissed group with Restore.
7. **Recent activity** — last 5 transactions in the Transactions row grammar
   (avatar, merchant, Pending chip, review dot, "Category · day", amount).
8. **Where it went** — category spend bar, last because it's analysis rather
   than action; "View all" → Transactions.

Pull-to-refresh (native `RefreshControl`) replaces the web's toast-based sync
status for a manual refresh gesture; a persistent top banner still appears on
sync failure per `DESIGN.md §8` "Toasts" rule (sync failure = persistent
banner, not a toast, unchanged).

### 5.3 Transactions (Phase B)

- **Card list**, not a table — `DESIGN.md §10.2`'s explicit web mobile note
  already calls this out: merchant + category on the left, amount right-aligned
  on the right, secondary line (account mask, date) beneath the merchant name.
  Row height ~64 (taller than web's 44px table row — mobile needs more vertical
  breathing room per row when stacking two lines of text instead of one row of
  columns).
- **Filter bar**: collapsed to a single "Filters" pill above the list (not a
  sticky multi-field bar — no room) that opens a **filter bottom sheet** (date
  range, accounts, categories, amount range, search) — this is the mobile
  equivalent of the web's sticky filter bar, same fields, different container.
- **Quick-categorize**: swipe-left on a row reveals a categorize action
  (replaces web's "row hover reveals quick-categorize" — hover doesn't exist
  on touch); tapping the row opens the detail bottom sheet where full
  editing (notes, split, "always categorize this way") happens, matching
  `DESIGN.md §8`'s side-panel content, now in sheet form.
- **Bulk select**: long-press a row to enter select mode (checkbox appears on
  every row), bottom action bar slides up — same interaction as web's
  bulk-select action bar, triggered by long-press instead of a checkbox click
  since there's no persistent checkbox column at rest.
- Infinite scroll (not pagination controls) via TanStack Query's
  `useInfiniteQuery`, loading skeleton rows (shape-matched blocks per
  `DESIGN.md §8` "Skeletons") appended at the list end while fetching more.

### 5.4 Transaction detail (redesigned in app 1.25.0)

A modal screen with the same blocks and order as web's side panel; which
blocks apply comes from `@tally/core/transactionView`'s
`describeTransactionDetail`. Header: merchant, date and account, the amount
in serif 40 (text color, green for money in, gray while pending; cents in
text-3) and a "Needs review" / "✓ Reviewed" toggle. Then **Category**: the
current one with who set it ("Tally's guess", "Set by a rule", "Set by
you"), up to 3 suggestion chips (GET /api/transactions/[id] `suggestions`)
and "Always use X for Merchant" with the rules preview count. Picking a
category also marks it reviewed. **How it counts**: Counts in spend /
Excluded, then Split and Spread rows that open their own views. Split has
the only Save, disabled until the lines add up; Spread previews the monthly
amount and confirms, and can change term or stop. **Note and tags** (note
saves 600 ms after typing stops), then folded **Details** (original
description, account, status, a selectable ID). Delete shows only for rows
you added, with a confirm inside the screen. Every other change saves on its
own with an Undo toast. Transfers hide category, split and spread; a
spread's monthly installment rows are read-only. iOS sheets keep only the
safe-area offset at the bottom, with no extra padding on top of it.

### 5.5 Accounts (Phase B)

Redesigned in mobile v1.16.0. Every connection's health resolves through one
function, `src/lib/connectionState.ts`, to a level, a status line, at most one
notice and at most one action. Cards only render what it returns.

- **Top of screen**: TabHeader, then a Net worth / Assets / Debts summary
  (from `/api/accounts` totals). When any connection needs a tap, a strip
  ("2 banks need you": coral if any is blocked, amber otherwise) opens the
  Fix sheet, which lists each problem bank with its own action.
- **Levels**: *quiet* (healthy: dot + "Synced 12m ago" only), *info* (6–48h
  behind, importing history, just reconnected: no action), *act* (not synced
  >48h or never, access ending, bank error: amber ring, notice and button),
  *blocked* (sign-in expired, access revoked: coral ring and notice, balances
  dimmed, card collapsed to an "as of" total). Cards sort blocked → act →
  info → quiet, then by name.
- **Buttons take their state's color** (coral, amber), never brand green,
  so the button reads as the same severity as the notice it sits in. Only
  "Remove" (revoked) is neutral, since it's an alternative, not the fix.
- **Different problems, different fixes**: an expired sign-in or revoked
  access opens Plaid Link in update mode; a bank error retries first and
  offers "Sign in again" after 24h down or a failed retry; a stale or
  never-synced connection offers "Sync now" first.
- Healthy cards with more than 3 accounts show 3 plus "+N more". Missing
  balances render "—", not $0.00. Accounts with no bank connection are
  listed under "Other accounts".
- Sync-all completion is a toast; a partial or total failure is a persistent,
  dismissible banner (the §8 toast rule). Pull-to-refresh refetches.
- Loading is shape-matched skeletons; no data + error is a "Couldn't load"
  card with Try again; cached data + error keeps the data with a banner.

### 5.5b Investments

Pushed screen from the More sheet, same order and shared logic as web
(`@tally/core/investments`): stale-connection notices, then the chart hero
(value, "+growth · +added · range", a plain-SVG chart in
components/charts/PortfolioChart.tsx with money-in dashed under it; dragging
scrubs the hero figure, and the ScrollView locks while a finger is on it),
the range switch, Invested/Growth with a split bar, Allocation (Type /
Account), the top 5 holdings rolled up across accounts with gain, and recent
activity in plain verbs with this year's income and contributions. "All N"
opens `investment-holdings` (account filter + sort); tapping any holding
opens HoldingSheet. Individual holdings stay unmasked in privacy mode
(MoneyText's documented scope); portfolio totals mask.

### 5.6 Budgets (Phase C)

Full parity target with the web Budgets page (`apps/web/app/(app)/budgets/page.tsx`)
— web is the reference implementation; every behavior below exists there today
unless marked **(mobile-only addition)** or **(open question, not on web either)**.

- **Header**: "Budgets" title + "{N} categories budgeted" count, matching
  web's header line.
- **Month stepper**: chevrons (‹ August 2026 ›) as today, *plus* swipe
  left/right on the list to change month — an addition beyond web (which only
  has the chevron links), kept because it's a natural native gesture here.
  Changing month always refetches from `GET /api/budgets?month=`; the current
  calendar month silently seeds itself from the prior month's rows if it has
  none yet (server-side behavior already in `ensureMonthSeeded`, nothing for
  mobile to implement) — never true for a past/future month browsed via the
  stepper.
- **Summary row**: three stat tiles — Budgeted, Spent, Remaining — same
  horizontally-scrollable stat-tile strip pattern as the Overview KPI row
  (§5.2), replacing the current single "Total this month" card so mobile
  shows the same three figures web's summary cards do. Remaining colored
  `--negative` when over, `--positive` otherwise. Hidden entirely when there
  are zero budget rows for the month (same gate as web).
- **Category rows** (`MeterBar`): per-category meter bar, unchanged track/fill
  mechanics from `DESIGN.md §8` "Meter bar," with three fill-color tiers
  matching web — series color under 80% of budget, `--warning` at ≥80% and
  not yet over, `--negative` for the overage portion once over. Row text:
  "$X of $Y" normally, "Overspent by $X" once over (already implemented).
  Rollover amount shown as a small "+$X rollover" tag next to the category
  name when nonzero, matching web.
- **Burn-rate projection marker**: dashed vertical marker on the meter bar +
  "Projected $X by month end" caption beneath, using `@tally/core`'s
  `computeBurnRateProjection` (`spend_to_date / days_elapsed × days_in_month`)
  — shown only when viewing the current month *and* the budget is not
  `isFixedAmount` (a fixed-amount budget like rent/insurance posts once and
  doesn't accrue, so a burn-rate projection is meaningless for it), same gate
  as web's `BudgetRow`/`BudgetMeterList`. Not implemented on mobile today —
  the flag is captured on create but never consulted for rendering.
- **Row tap → edit sheet**: tapping a category row opens a bottom sheet (the
  existing `AddBudgetSheet`, generalized to also prefill/edit) with the same
  fields as add — amount, Rollover switch, Fixed-amount switch — plus:
  - **"View transactions"** — routes to the Transactions tab filtered to
    that category + the viewed month's date range, `transfer` and `excluded`
    both off, mirroring web's per-row "View" link into
    `/transactions?category=<id>&from=<month>&to=<monthLastDay>&transfer=0&excluded=0`.
  - **"Remove budget"** — destructive action, confirm before calling
    `DELETE /api/budgets`, matching web's confirm-then-delete row action.
  Both are entirely missing today; only create exists (`AddBudgetSheet`
  with no corresponding edit/delete path).
- **Add flow**: unchanged — "+" opens a sheet with a category picker limited
  to not-yet-budgeted expense categories, with inline "create a new category"
  support, submitting the same upsert (`PUT /api/budgets`) web's Add form
  uses.
- **Footer totals**: pinned above the tab bar (not scrolled away), so the
  overall Budgeted/Spent/Remaining figures stay visible while scrolling
  categories — needs a fixed footer view outside the `ScrollView`; today the
  summary renders inline at the top of the scroll instead (called out as
  deferred in the screen's own code comment).
- **Empty state**: icon + "No budgets yet" + a description naming the viewed
  month, matching web's `EmptyState` treatment — today it's a bare line of
  text with no icon or CTA.
- **Loading state**: shape-matched skeleton rows (per `DESIGN.md §8`
  "Skeletons," same convention already used on Transactions) instead of a
  bare spinner.
- **Error state**: an `isError` branch with a retry action — not read from
  `useBudgets` today, so a failed fetch currently has no visible error UI.
- Amounts on this screen are **never masked** by the app's "hide amounts"
  privacy toggle, matching web (a budget figure without its amount isn't
  useful) — already correct on both platforms, keep it that way.

**Open question, not on web either** — `DESIGN.md §10` calls for per-category
rows "grouped by parent category with a subtotal row per group" and
"'Copy last month' and 'Set from 3-month average' actions," but the actual
web implementation never built either: budgets render as a flat list sorted
by spend, and the only "copy last month" behavior is the invisible
current-month auto-seed described above, with no user-facing button on
either platform. Don't silently port these to mobile as a parity item — if
they're wanted, they're new functionality on *both* platforms and should be
scoped as their own piece of work, not folded into this parity pass.

### 5.7 Subscriptions (Phase C)

Flat list (no institution grouping — recurring streams aren't necessarily one
per account), each row: merchant, cadence label ("Monthly", "Annual"), amount,
next predicted date as a relative chip ("in 4 days"). Header shows monthly +
annualized totals as two small stat figures side by side. At-risk/cancelled
states get the same status-badge treatment as connection health.

### 5.8 FIRE calculator (Phase D)

Single scrolling form: inputs (current net worth, monthly savings, expected
return, SWR — matching whatever `fireSettings` shape `lib/fireMath.ts` already
defines) rendered as standard mobile form fields (label above, `--surface`
background, `--border-strong` border, per `DESIGN.md §8` "Inputs"), with the
computed result (years to FIRE, target age/year if a birthdate is set,
projected FIRE number) rendered live beneath as a `display-m` serif hero
figure — recompute on every input change via `@tally/core`'s pure
`fireMath.ts`, no server round-trip needed for the calculation itself (only
persisting settings requires an API call).

---

## 6. Component adaptations

| Web component (`DESIGN.md §8`) | Mobile equivalent |
|---|---|
| Card / panel (hairline border, near-flat) | Soft shadow card, no visible border, 18px radius (see §3.4) |
| Table | Card list (row = merchant/category left, amount right, 2-line stack) |
| Side panel (420px, slide from right) | Bottom sheet (85% height, slide up) |
| Modal | Centered modal, unchanged (Plaid Link, confirm dialogs) |
| Row hover quick-categorize | Swipe-left action |
| Bulk-select via checkbox column | Long-press to enter select mode |
| Sticky filter bar | "Filters" pill → filter bottom sheet |
| Left nav (240px) | Bottom tab bar (4 tabs) + header |
| Toast (bottom-right, 4s) | Toast (bottom-center, above tab bar, 4s) — same content rule: sync completion is a toast, sync failure is a persistent banner |
| Skeleton | Same shape-matched `--sunken` blocks, no changes needed |
| Stat tile | Same anatomy, narrower fixed width for horizontal scroll strip on Overview |
| Meter bar | Unchanged anatomy, full width of screen minus 16px page padding |
| Category pill, badge/status chip | Unchanged anatomy — already touch-target-safe at 24px/20px tall with adequate tap padding added on mobile (effective tap area padded to 44px even though visual pill stays compact) |

---

## 7. Motion (mobile-specific timing, same easing philosophy as `DESIGN.md §11`)

| Element | Duration | Notes |
|---|---|---|
| Bottom sheet open/close | 250ms | Native `react-native-reanimated`/sheet-library spring, not a fixed-duration ease — sheets should feel physically dragged |
| Tab switch | instant | No cross-fade; native tab navigators default to instant, don't fight it |
| Swipe action reveal | tracks finger 1:1 | Snap open/closed with a spring on release |
| Pull-to-refresh | native platform default | Don't reimplement — `RefreshControl` |
| Number count-up (stat tiles) | 300ms, same as web | Only on first mount / real value change, not on every re-render |

Respect the OS reduce-motion setting per §4 above.

---

## 8. Open questions carried from the implementation plan

- Whether "More" (Subscriptions/Investments/FIRE/Settings) stays a header
  action or becomes a 5th tab — revisit once Investments (not yet in the
  rollout phases A–D) is scheduled.
- Exact `fireSettings` field list for §5.8's form — pull directly from
  `lib/fireMath.ts`'s actual types when building the screen, don't guess the
  shape here.
- Whether category color assignment (chart series slot per category) needs
  any mobile-specific legend treatment beyond the pill dot already specced in
  `DESIGN.md §8` "Category pill" — likely not, revisit only if a category
  legend screen is added later.
- Whether Budgets' parent-category grouping/subtotals and the "Copy last
  month" / "Set from 3-month average" bulk actions (specced in
  `DESIGN.md §10` but never built on web — see §5.6) should actually be
  built at all, and if so on which platform first. Cross-platform decision,
  not a mobile-parity item.
