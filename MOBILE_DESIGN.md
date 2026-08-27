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
| canvas | `#F5F4F0` |
| surface | `#FCFCFB` |
| surface-2 | `#F9F8F5` |
| sunken | `#EFEDE8` |
| border | `#E4E1D9` |
| border-strong | `#938C7D` |
| text | `#1A1917` |
| text-2 | `#524F47` |
| text-3 | `#6A665E` |
| brand | `#14513F` |
| brand-hover (→ pressed state) | `#0E3E30` |
| brand-subtle | `#E6EFEA` |
| brand-border | `#BFD6CB` |
| on-brand | `#FFFFFF` |
| positive | `#0F7A57` |
| negative | `#B23A2C` |
| warning | `#8A5A00` |
| info | `#2A78D6` |

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

### 5.2 Overview (Phase B, condensed from `DESIGN.md §10.1`)

Single scrolling column, in this order:
1. **Hero net-worth card** — `display-l` serif figure, delta chip (arrow +
   % + "vs last month"), 12-month sparkline beneath (same line-chart form as
   web, `react-native-gifted-charts`, no axis labels at this size).
2. **Connections health** — collapsed to a single-line status row ("All 4
   accounts synced" / "1 connection needs attention →") rather than the web's
   separate card; tapping routes to Accounts tab. Full detail lives there, not
   duplicated here.
3. **KPI row** — horizontally scrollable stat-tile strip (Spent this month,
   Income, Cash flow, Credit utilization) instead of the web's 4-column grid;
   each tile ~140px wide, swipeable, dot pagination indicator beneath if it
   overflows the viewport.
4. **Budget this month** — top 3 categories by spend as meter rows (full
   `DESIGN.md §8` meter-bar spec unchanged), "View all budgets" link to the
   Budgets tab rather than rendering every category inline.
5. **Upcoming** — next 3 bills/due dates as a compact list (label + date chip
   + amount), "View all" if more exist.
6. **Recent activity** — last 5 transactions, tap → transaction detail sheet.

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

### 5.4 Transaction detail (Phase B)

Bottom sheet, ~85% screen height, scrollable: amount (large, tabular, signed +
colored per `DESIGN.md §5.4`), merchant + logo, date, account, category
(tappable pill → category picker sheet-on-sheet), notes field, split editor
entry point, "always categorize this merchant this way" toggle. Sheet handle
at top, swipe-down or backdrop-tap to dismiss.

### 5.5 Accounts (Phase B)

- Grouped by institution, same as `DESIGN.md §10.3` — each institution as a
  card: logo, name, health badge (Fresh/Stale/Needs attention, same
  `DESIGN.md §5.3` status colors + icon + label), "Updated Xh ago", then each
  account as a row beneath (name, mask in mono, balance right-aligned).
- Broken connection: card gets a `critical` badge and a full-width
  "Reconnect" primary button beneath its account rows (not a small inline
  link) — reconnecting on a phone is a deliberate, unmissable action.
- Pull-to-refresh triggers a manual sync check (`app/api/items/[id]/sync` per
  account, or the aggregate `app/api/sync` — implementation detail for Phase
  2/B, not a UI concern here).

### 5.6 Budgets (Phase C)

Month stepper at top (‹ August 2026 ›, swipe left/right also changes month).
Per-category meter rows, same spec as `DESIGN.md §8` "Meter bar" — track,
fill in category series color, over-budget portion in `--negative`, dashed
projection marker. Grouped by parent category with a subtotal row per group,
footer totals row pinned above the tab bar (not scrolled away) so the overall
"X of Y this month" figure stays visible while scrolling categories.

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
