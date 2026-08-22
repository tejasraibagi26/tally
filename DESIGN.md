# DESIGN.md — Spec Sheet: "Tally"

The visual contract for the app defined in `WORK.md`. **§1** is the copy-paste prompt for Claude Design (it embeds the tokens, so it works standalone). **§2 onward** is the full system — implement against it, don't re-invent per screen.

Design direction in one line: **a quiet, editorial ledger** — warm paper neutrals, a single deep evergreen accent, serif hero numbers, and dense-but-breathable tables. It should feel like a well-set financial report, not a crypto dashboard.

---

## 1. Prompt for Claude Design (copy-paste this)

```text
Design a high-fidelity prototype for "Tally", a private personal-finance dashboard
that connects to bank, credit card, and brokerage accounts via Plaid and tracks a
monthly budget automatically.

Art direction: quiet and editorial. Warm paper neutrals, one deep evergreen accent,
serif display numerals against a clean sans UI, hairline rules instead of heavy
shadows, generous whitespace around dense data tables. Calm, trustworthy,
non-gamified. Think a beautifully typeset financial report — not a fintech neon
dashboard. Light and dark mode, both designed on purpose.

TYPE
- Display / hero numbers: Instrument Serif, regular. Used for the one big number
  per screen and for section titles on marketing-ish surfaces.
- UI: Inter (400/500/600). All tabular numbers use tabular-nums.
- Mono: JetBrains Mono, for tickers, account masks, IDs, and API-ish strings.
- Scale: display 56/40/32; h1 24/600; h2 20/600; h3 16/600; body 15/1.55;
  small 13.5; label 12/500 uppercase with 0.06em tracking; mono 12.5.

COLOR — light
  canvas #F5F4F0 · surface #FCFCFB · surface-2 #F9F8F5 · sunken #EFEDE8
  border #E4E1D9 · border-strong #CFCBC0
  text #1A1917 · text-2 #63615A · text-3 #938F87
  brand #14513F (evergreen) · brand-hover #0E3E30 · brand-subtle #E6EFEA
  positive #0F7A57 · negative #B23A2C · warning #8A5A00 · info #2A78D6

COLOR — dark
  canvas #111110 · surface #1A1A19 · surface-2 #232320 · sunken #0C0C0B
  border #2B2B28 · border-strong #3D3D38
  text #F2F1ED · text-2 #A8A69D · text-3 #77756D
  brand #4FB394 · brand-hover #6AC5A9 · brand-subtle #14251F
  positive #4FC49B · negative #F0846B · warning #E0A94A · info #3987E5

CHART SERIES (fixed order, never cycled, never re-ordered)
  light: #1baf7a #eb6834 #2a78d6 #eda100 #e87ba4 #008300 #4a3aa7 #e34948
  dark:  #199e70 #d95926 #3987e5 #c98500 #d55181 #008300 #9085e9 #e66767
  A 9th category folds into "Other". Scatter/bubble use only the first 3 slots.
  Never a dual-axis chart. Sequential = one blue hue light-to-dark. Diverging =
  blue-to-red through a gray midpoint. Legend always present for 2+ series.

SHAPE & SPACE
  4px spacing base (4/8/12/16/24/32/48/64). Radii: 8 controls, 12 cards, 16 panels,
  999 pills. 1px hairline borders. Shadows barely there:
  0 1px 2px rgba(26,25,23,.06) resting, 0 12px 32px -8px rgba(26,25,23,.14) overlay.
  Max content width 1280px; app shell = 240px left nav + fluid content.

SCREENS TO DESIGN (desktop 1440, plus mobile 390 for the first three)
1. Overview — hero net worth in serif with a 12-month sparkline; four KPI tiles
   (Spent this month, Income, Cash flow, Credit utilization); a "Budget this month"
   panel of horizontal meter bars per category; "Where it went" ranked horizontal
   bar chart by category; "Upcoming" list of bills and card due dates; "Recent
   activity" list of 6 transactions with merchant logos.
2. Transactions — dense table: date, merchant (logo + name), account (institution
   glyph + mask), category (editable pill), amount right-aligned tabular with
   sign color. Sticky filter bar: date range, accounts, categories, search, amount
   range. Row hover reveals quick-categorize. Bulk-select action bar. Right side
   panel for a single transaction (detail, notes, tags, split, "always categorize
   this merchant this way").
3. Accounts & Connections — grouped by institution card: institution logo, health
   badge (Fresh / Stale / Needs attention), last-synced timestamp, per-account rows
   with balance. One card in a broken "Reconnect" state. Plaid Link modal moment.
4. Budgets — month picker; per-category rows with a meter bar, spent / budget /
   remaining, and a dashed "projected end of month" marker; over-budget rows in
   negative color with an icon and label, never color alone.
5. Investments — total portfolio value in serif, allocation as a single stacked
   horizontal bar with 2px gaps plus a labeled legend, holdings table (ticker in
   mono, name, quantity, price, value, cost basis, gain/loss), performance line
   chart with a range switcher.
6. Credit cards — one card panel per card: balance vs limit as a utilization
   meter, statement balance, minimum payment, due date countdown, APR list.
7. Subscriptions & Recurring — list with predicted next date, monthly and
   annualized totals, cancelled/at-risk states.
8. Empty + loading states for Overview and Transactions (skeletons, not spinners).

RULES
- Every number is tabular-figured and right-aligned in tables.
- Positive/negative amounts carry a sign and a color, never color alone.
- Every metric tile is clickable and states what it drills into.
- Show data freshness ("Updated 2h ago") next to any aggregate.
- Currency: $1,284.30 · large values abbreviate to $1.28M only in tiles, never in tables.

Deliver desktop artboards for all 8 screens, mobile for 1–3, and one artboard of the
component/token sheet (buttons, inputs, pills, badges, table row, meter, KPI tile,
chart legend) in both light and dark.
```

---

## 2. Principles

1. **The number is the interface.** Typography and alignment do the work; decoration doesn't.
2. **Nothing unattributable.** Every aggregate drills into the rows that made it, and shows how fresh it is.
3. **Calm by default, loud only when it matters.** Color is reserved for money direction and status. A screen where everything is colored is a screen where nothing is.
4. **Density with air.** Tables are tight (44px rows); the space around them is generous.
5. **Two real themes.** Dark mode is designed, not inverted.
6. **Never color alone.** Sign, icon, or label always accompanies a color-carried meaning.

---

## 3. Brand

- **Name:** Tally. **Mark:** four tally strokes with the fifth crossing, drawn at a 2px stroke in the brand evergreen; works at 16px.
- **Voice:** plain, specific, unsentimental. "You've spent $2,140 of $2,600." Not "Great job! 🎉"
- **Accent discipline:** the evergreen brand color marks *interaction* (primary buttons, active nav, focus). It is **never** used as a chart series color and never as a money color.

---

## 4. Typography

| Role | Family | Size / line | Weight | Notes |
|---|---|---|---|---|
| `display-xl` | Instrument Serif | 56 / 1.02 | 400 | Hero net worth only |
| `display-l` | Instrument Serif | 40 / 1.06 | 400 | Screen hero numbers |
| `display-m` | Instrument Serif | 32 / 1.1 | 400 | Panel hero numbers |
| `h1` | Inter | 24 / 1.25 | 600 | Page title |
| `h2` | Inter | 20 / 1.3 | 600 | Panel title |
| `h3` | Inter | 16 / 1.4 | 600 | Card title, table group header |
| `body` | Inter | 15 / 1.55 | 400 | Default |
| `body-strong` | Inter | 15 / 1.55 | 500 | Table primary cell |
| `small` | Inter | 13.5 / 1.5 | 400 | Secondary metadata |
| `label` | Inter | 12 / 1.2 | 500 | Uppercase, letter-spacing 0.06em, `text-2` |
| `mono` | JetBrains Mono | 12.5 / 1.45 | 400 | Tickers, masks, IDs |

**Numeral rules**
- Everything numeric: `font-variant-numeric: tabular-nums;` — no exceptions, including hero numbers.
- Currency in tables and lists: full precision, right-aligned, cents in the same size as dollars.
- Instrument Serif is for *display* numbers only. Never set a table in it.
- Fonts load from Google Fonts with fallbacks: `Inter, ui-sans-serif, system-ui, sans-serif` · `"Instrument Serif", Georgia, serif` · `"JetBrains Mono", ui-monospace, monospace`.

---

## 5. Color

### 5.1 Light

| Token | Hex | Use |
|---|---|---|
| `--canvas` | `#F5F4F0` | App background |
| `--surface` | `#FCFCFB` | Cards, tables, chart surface |
| `--surface-2` | `#F9F8F5` | Nested/secondary surface |
| `--sunken` | `#EFEDE8` | Wells, table header, input rest |
| `--border` | `#E4E1D9` | Hairlines, dividers |
| `--border-strong` | `#CFCBC0` | Input border, focused container |
| `--text` | `#1A1917` | Primary |
| `--text-2` | `#63615A` | Secondary, labels |
| `--text-3` | `#938F87` | Tertiary, placeholders, axis |
| `--brand` | `#14513F` | Primary action, active nav |
| `--brand-hover` | `#0E3E30` | Hover/pressed |
| `--brand-subtle` | `#E6EFEA` | Selected row, brand-tinted chip |
| `--brand-border` | `#BFD6CB` | Border on brand-subtle |
| `--on-brand` | `#FFFFFF` | Text on brand |
| `--positive` | `#0F7A57` | Income, gains |
| `--negative` | `#B23A2C` | Spend, losses, over budget |
| `--warning` | `#8A5A00` | Approaching limit |
| `--info` | `#2A78D6` | Neutral emphasis, focus ring |

### 5.2 Dark

| Token | Hex | Token | Hex |
|---|---|---|---|
| `--canvas` | `#111110` | `--text` | `#F2F1ED` |
| `--surface` | `#1A1A19` | `--text-2` | `#A8A69D` |
| `--surface-2` | `#232320` | `--text-3` | `#77756D` |
| `--sunken` | `#0C0C0B` | `--brand` | `#4FB394` |
| `--border` | `#2B2B28` | `--brand-hover` | `#6AC5A9` |
| `--border-strong` | `#3D3D38` | `--brand-subtle` | `#14251F` |
| `--on-brand` | `#0C1A15` | `--brand-border` | `#234438` |
| `--positive` | `#4FC49B` | `--negative` | `#F0846B` |
| `--warning` | `#E0A94A` | `--info` | `#3987E5` |

### 5.3 Status (fixed in both themes — never themed, never reused as a series color)

| Role | Hex | Used for |
|---|---|---|
| good | `#0CA30C` | Connection fresh, budget on track |
| warning | `#FAB219` | Stale sync, budget ≥80% |
| serious | `#EC835A` | Due within 3 days, budget ≥100% |
| critical | `#D03B3B` | Connection broken, payment overdue |

Status colors **always ship with an icon and a text label**. On the light surface `warning` and `serious` fall below 3:1 — the icon+label pairing is the mitigation, not an optional nicety.

### 5.4 Money color rules
- `--positive` / `--negative` apply to **amounts and deltas only** — never to a chart series, never to a whole row's background.
- A negative amount is written `−$412.90` (true minus sign, U+2212) *and* colored. Screenshots get printed in grayscale; the sign has to survive.
- Neutral amounts (transfers, $0) use `--text`, not a color.

---

## 6. Layout, shape, elevation

- **Grid:** 12 columns, 24px gutter, page padding 32 (desktop) / 16 (mobile). Content max-width 1280px, centered.
- **App shell:** fixed 240px left nav (collapses to 64px icon rail < 1200px, drawer < 900px), 64px top bar with month picker + global search + sync status.
- **Spacing scale (px):** 4, 8, 12, 16, 24, 32, 48, 64, 96. Nothing off-scale.
- **Radii:** 8 (buttons, inputs, chips) · 12 (cards) · 16 (panels, modals) · 999 (pills, avatars).
- **Borders:** 1px `--border` everywhere; `--border-strong` only for focus and inputs.
- **Elevation** — hairlines first, shadow second:
  - `rest`: border only.
  - `raised`: `0 1px 2px rgba(26,25,23,.06)`.
  - `overlay` (menus, popovers): `0 12px 32px -8px rgba(26,25,23,.14)` + border.
  - Dark mode: drop the shadow, raise `--surface-2` one step instead.
- **Focus:** 2px `--info` ring at 2px offset, on every interactive element, always visible on keyboard.

---

## 7. Charts & data visualization

### 7.1 Series palette (validated — do not substitute)

| Slot | Hue | Light | Dark |
|---|---|---|---|
| 1 | aqua | `#1baf7a` | `#199e70` |
| 2 | orange | `#eb6834` | `#d95926` |
| 3 | blue | `#2a78d6` | `#3987e5` |
| 4 | yellow | `#eda100` | `#c98500` |
| 5 | magenta | `#e87ba4` | `#d55181` |
| 6 | green | `#008300` | `#008300` |
| 7 | violet | `#4a3aa7` | `#9085e9` |
| 8 | red | `#e34948` | `#e66767` |

This exact **order** is the colorblind-safety mechanism, not a preference. It was validated against light surface `#FCFCFB` and dark surface `#1A1A19`: worst adjacent-pair CVD separation ΔE 9.2 light / 9.4 dark (target ≥8), worst normal-vision separation 19.6 light / 19.3 dark (floor ≥15). Re-ordering or swapping a hex invalidates that — re-run the validator if you must.

**Rules**
- Assign slots in fixed order and **never cycle**. A 9th category becomes "Other".
- **Color follows the entity**: filtering out a series must not repaint the survivors. Bind color to category id, not to rank.
- Forms where every series touches every other (scatter, bubble) are capped at the **first 3 slots**; past that, facet into small multiples.
- Light-mode slots 1, 4, and 5 sit below 3:1 against the surface — those charts must carry **direct labels or a table view** (the "relief rule").
- **Sequential** (heatmaps, calendar intensity): one blue hue, light→dark — `#cde2fb #9ec5f4 #6da7ec #3987e5 #256abf #184f95 #0d366b`. On the light surface start no lighter than `#86b6ef` for discrete/ordinal marks.
- **Diverging** (over/under budget, gain/loss maps): blue ↔ red through a gray midpoint (`#F0EFEC` light, `#383835` dark). Never a hue at the midpoint.

### 7.2 Which chart for which job

| Question | Form | Not this |
|---|---|---|
| Net worth over time | Single 2px line + 8% area fill, dot on hover | Bars |
| Cash flow by month | Diverging bars from a zero baseline (income up, spend down) | Stacked bars, dual axis |
| Spend by category | Ranked **horizontal** bars, value direct-labeled | Donut, pie |
| Portfolio allocation | One stacked horizontal bar, 2px gaps, labeled legend | Pie with 11 slices |
| Budget progress | Meter bar with a projection marker | Gauge/speedometer |
| A single headline figure | Stat tile — serif number + label + delta chip | A one-bar chart |
| Portfolio performance | Line, indexed to 100 at range start | Dual-axis vs. a benchmark |

**Hard bans:** dual y-axes (ever), 3D, pie charts with more than 5 slices, truncated y-axes on bar charts, rainbow sequential ramps, values printed on every point.

### 7.3 Mark and anatomy specs
- Lines 2px; markers ≥8px; bar ends rounded 4px on the data end only, anchored square to the baseline.
- 2px surface-colored gap between stacked segments and between adjacent bars; a 2px surface ring on overlapping marks.
- Grid: horizontal only, 1px `--border`, no vertical grid. Axis text `--text-3`, 12px, no axis lines where the grid already implies them.
- Direct-label the top 3 values; leave the rest to hover.
- **Legend is mandatory for ≥2 series** (a single-series chart needs none — the title names it). ≤4 series are also direct-labeled.
- Legend and value text wear `--text` / `--text-2` — never the series color. The swatch beside them carries identity.

### 7.4 Interaction
- Line/area: crosshair + a tooltip listing every series at that x, sorted by value, with the hovered one bolded.
- Bar/dot/cell: per-mark tooltip; hit target larger than the mark.
- Filters (date range, accounts, categories) live in one row above the chart group and apply to all charts on the screen.
- Every chart has a **"View as table"** toggle — this is the accessibility fallback and the relief-rule mitigation at once.

### 7.5 Stat tile
```
┌──────────────────────────────┐
│ SPENT THIS MONTH        ⌄    │  label 12 uppercase, --text-2
│ $2,140.55                    │  Instrument Serif 40, tabular
│ ▲ 12% vs last month          │  chip: arrow + % + label, small
│ 68% of $3,150 budget         │  small, --text-2
└──────────────────────────────┘
```
The delta chip uses `--positive`/`--negative` *and* an arrow glyph *and* a comparison label. Entire tile is a link to the filtered transaction list.

---

## 8. Components

**Buttons** — height 36 (sm 30, lg 44), radius 8, 15px/500, 12px horizontal padding + 8px icon gap.
- *Primary*: `--brand` bg, `--on-brand` text, hover `--brand-hover`.
- *Secondary*: `--surface` bg, `--border-strong` border, `--text`.
- *Ghost*: transparent, hover `--sunken`.
- *Destructive*: `--negative` text on transparent; solid only inside a confirm dialog.
- Disabled: 40% opacity, no hover. Loading: inline 14px spinner, label persists.

**Inputs** — height 36, radius 8, `--surface` bg, 1px `--border-strong`, 15px text, 12px label above in `--label`. Error: `--negative` border + message with an icon. Amount inputs are right-aligned, mono-adjacent tabular, with the currency symbol as a prefix affix in `--text-3`.

**Category pill** — radius 999, 24px tall, 8px dot in the category's series color + name, `--surface-2` bg, `--border`. Editable inline: click → combobox with search and a "create category" row.

**Badge / status chip** — radius 6, 20px, 12px/500, icon + label. Colors from §5.3 only.

**Card / panel** — `--surface`, radius 12, 1px `--border`, 20px padding, header row: `h3` title left + optional action right + optional "Updated 2h ago" in `small`/`--text-3`.

**Table** — header row `--sunken`, 12px uppercase labels, sticky. Body rows 44px, 1px bottom hairline, hover `--surface-2`, selected `--brand-subtle`. Numeric columns right-aligned and tabular. Merchant cell: 20px logo (fallback: initial on a `--sunken` circle) + name + secondary line. Zebra striping is **not** used — hairlines only.

**Meter bar** (budget/utilization) — 8px tall, radius 999, track `--sunken`, fill in the category series color, over-budget portion in `--negative`, dashed 2px `--text-3` projection marker, label above (`Spent $X of $Y`) and remaining right-aligned.

**Side panel** — 420px, slides from the right, overlay shadow, ESC + click-outside to close, focus trapped.

**Modal** — 480/640px, radius 16, centered, `--canvas` scrim at 60%. Plaid Link renders in its own iframe modal — don't restyle it; just center it and dim behind.

**Empty states** — one line of what's missing, one primary action, no illustration. e.g. "No transactions in this range." → *Change dates*.

**Skeletons** — shape-matched blocks in `--sunken` with a 1.2s shimmer. Never a centered spinner on a full page.

**Toasts** — bottom-right, 4s, icon + message + optional undo. Sync completion is a toast; sync failure is a persistent banner.

---

## 9. Formatting rules

| Thing | Rule | Example |
|---|---|---|
| Currency | Symbol + grouped + 2 decimals | `$1,284.30` |
| Negative | True minus sign, colored | `−$412.90` |
| Abbreviated | Tiles and axes only, 2 sig decimals | `$1.28M`, `$42.1K` |
| Percent | 1 decimal under 10%, else 0 | `4.2%`, `68%` |
| Date (table) | `MMM D` same year, else `MMM D, YYYY` | `Aug 14` |
| Date (detail) | `EEE, MMM D, YYYY` | `Thu, Aug 14, 2026` |
| Relative | Under 7 days, then absolute | `2h ago`, `Yesterday` |
| Account | Name + masked digits in mono | `Chase Sapphire ····4021` |
| Ticker | Mono, uppercase | `VTSAX` |
| Pending | Italic amount + a "Pending" chip | |
| Unknown | Em dash, never `0` or `N/A` | `—` |

---

## 10. Screen specs

1. **Overview** — Row 1: hero net-worth card (serif `display-xl`, delta chip, 12-month sparkline) spanning 8 cols + "Connections" health card, 4 cols. Row 2: four stat tiles. Row 3: "Budget this month" (7 cols, meter list) + "Where it went" (5 cols, ranked horizontal bars). Row 4: "Upcoming" (bills + card due dates, 5 cols) + "Recent activity" (7 cols, 6 rows + "View all").
2. **Transactions** — sticky filter bar; virtualized table; bulk-select action bar slides up from the bottom when rows are checked; right side panel for detail/edit/split; keyboard: `j/k` move, `c` categorize, `x` select, `/` search.
3. **Accounts & Connections** — one card per institution with health badge, last sync, refresh button, and its accounts as rows. Broken items get a `critical` badge and a "Reconnect" primary button that opens Link in update mode.
4. **Budgets** — month stepper; per-category meter rows grouped by parent category; footer totals row; "Copy last month" and "Set from 3-month average" actions.
5. **Investments** — hero portfolio value; allocation stacked bar + legend; holdings table; performance line with 1M/3M/YTD/1Y/All switcher; per-account tabs. Accounts without investment-transaction support hide the activity tab entirely.
6. **Credit cards** — one panel per card: utilization meter, statement balance, minimum payment, due-date countdown chip (`serious` inside 3 days, `critical` if overdue), APR table. Cards with an unknown limit show `—` for utilization plus a footnote.
7. **Subscriptions & recurring** — table with merchant, cadence, average amount, next predicted date, status; header totals for monthly and annualized spend.
8. **Settings** — Connections, Categories, Rules (list + editor with live preview count), Notifications, Export, Danger zone (delete item, wipe data).

**Mobile (390):** bottom tab bar (Overview / Transactions / Budgets / Accounts). Tables become card lists — merchant + category on the left, amount on the right. Quick-categorize is a bottom sheet. Charts keep the same forms, shortened to 6 data points where needed; never turn a chart into a pie because it's narrow.

---

## 11. Motion

| Element | Duration | Easing |
|---|---|---|
| Hover / color | 120ms | `ease-out` |
| Panel / sheet | 220ms | `cubic-bezier(.32,.72,0,1)` |
| Modal | 180ms fade + 2% scale | `ease-out` |
| Chart draw-in | 400ms, once per mount, no stagger on re-filter | `ease-out` |
| Number change | 300ms count-up, only in stat tiles | `ease-out` |

Respect `prefers-reduced-motion: reduce` — replace movement with an instant state change; charts render final-state.

---

## 12. Accessibility

- Body text ≥ 4.5:1, large text and UI borders ≥ 3:1 in both themes.
- Meaning never carried by color alone (sign, icon, label, or pattern always accompanies it).
- Every chart has a table view; charts carry `role="img"` with a summarizing `aria-label`, and the underlying data is reachable without hover.
- Full keyboard operation, visible focus, logical tab order, focus trapped in overlays and restored on close.
- Tables use real `<table>` semantics with `<th scope>`; sortable headers announce direction.
- Touch targets ≥ 44px on mobile.
- Text at 200% zoom must not clip; layouts reflow at 320px width.

---

## 13. Iconography & imagery

- **Lucide**, 20px default (16px inline), 1.75px stroke, `--text-2` unless carrying status.
- Institution logos come from Plaid (`logo` base64 / `logo_url`), rendered 20px in a circle with a hairline; fall back to the institution's `primary_color` behind its initial.
- Merchant logos from `transactions.logo_url`; same fallback treatment.
- No stock photography, no 3D illustration, no confetti.

---

## 14. Token block (paste into the app)

```css
:root {
  color-scheme: light;
  --canvas:#F5F4F0; --surface:#FCFCFB; --surface-2:#F9F8F5; --sunken:#EFEDE8;
  --border:#E4E1D9; --border-strong:#CFCBC0;
  --text:#1A1917; --text-2:#63615A; --text-3:#938F87;
  --brand:#14513F; --brand-hover:#0E3E30; --brand-subtle:#E6EFEA;
  --brand-border:#BFD6CB; --on-brand:#FFFFFF;
  --positive:#0F7A57; --negative:#B23A2C; --warning:#8A5A00; --info:#2A78D6;
  --status-good:#0CA30C; --status-warning:#FAB219;
  --status-serious:#EC835A; --status-critical:#D03B3B;
  --series-1:#1baf7a; --series-2:#eb6834; --series-3:#2a78d6; --series-4:#eda100;
  --series-5:#e87ba4; --series-6:#008300; --series-7:#4a3aa7; --series-8:#e34948;
  --radius-control:8px; --radius-card:12px; --radius-panel:16px;
  --shadow-raised:0 1px 2px rgba(26,25,23,.06);
  --shadow-overlay:0 12px 32px -8px rgba(26,25,23,.14);
  --font-ui:"Inter",ui-sans-serif,system-ui,sans-serif;
  --font-display:"Instrument Serif",Georgia,serif;
  --font-mono:"JetBrains Mono",ui-monospace,monospace;
}
@media (prefers-color-scheme: dark) {
  :root:where(:not([data-theme="light"])) {
    color-scheme: dark;
    --canvas:#111110; --surface:#1A1A19; --surface-2:#232320; --sunken:#0C0C0B;
    --border:#2B2B28; --border-strong:#3D3D38;
    --text:#F2F1ED; --text-2:#A8A69D; --text-3:#77756D;
    --brand:#4FB394; --brand-hover:#6AC5A9; --brand-subtle:#14251F;
    --brand-border:#234438; --on-brand:#0C1A15;
    --positive:#4FC49B; --negative:#F0846B; --warning:#E0A94A; --info:#3987E5;
    --series-1:#199e70; --series-2:#d95926; --series-3:#3987e5; --series-4:#c98500;
    --series-5:#d55181; --series-6:#008300; --series-7:#9085e9; --series-8:#e66767;
    --shadow-raised:none;
    --shadow-overlay:0 12px 32px -8px rgba(0,0,0,.6);
  }
}
:root[data-theme="dark"] {
  color-scheme: dark;
  --canvas:#111110; --surface:#1A1A19; --surface-2:#232320; --sunken:#0C0C0B;
  --border:#2B2B28; --border-strong:#3D3D38;
  --text:#F2F1ED; --text-2:#A8A69D; --text-3:#77756D;
  --brand:#4FB394; --brand-hover:#6AC5A9; --brand-subtle:#14251F;
  --brand-border:#234438; --on-brand:#0C1A15;
  --positive:#4FC49B; --negative:#F0846B; --warning:#E0A94A; --info:#3987E5;
  --series-1:#199e70; --series-2:#d95926; --series-3:#3987e5; --series-4:#c98500;
  --series-5:#d55181; --series-6:#008300; --series-7:#9085e9; --series-8:#e66767;
  --shadow-raised:none;
  --shadow-overlay:0 12px 32px -8px rgba(0,0,0,.6);
}

body { background: var(--canvas); color: var(--text); font-family: var(--font-ui); }
.tabular { font-variant-numeric: tabular-nums; }
```

---

## 15. Do not

- Do not use the brand green as a chart series color, or a series color as a status color.
- Do not build a dual-axis chart, a gauge, or a pie with more than 5 slices.
- Do not print a value on every data point.
- Do not show an aggregate without a drill-down and a freshness stamp.
- Do not communicate over/under budget with color alone.
- Do not invert light mode to make dark mode.
- Do not use non-tabular figures anywhere a number can change.
- Do not add gradients, glassmorphism, or an accent color that isn't in §5.
