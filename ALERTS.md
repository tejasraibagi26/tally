# ALERTS.md — Spec: Alerts (push + email)

Status: **shipped, email only** · 2026-09-30 · extends WORK.md §8.4

> **Update (web v1.15.2): push was dropped.** There's no paid Apple Developer account, so iOS can't get an APNs key (or universal links). Email is the only channel: every type defaults to email on, and quiet hours, "show amounts in notifications" and push tokens are gone from the app. The `push_tokens` table and the `push_sent_at`, `deliver_after` and `show_amounts` columns are still in the database, unused, so bringing push back needs no migration. Sections below that describe push (§5.1, §5.3, §5.4, step 5) are kept for that day.

Tally already knows when a budget is nearly spent, a connection broke, a
big charge landed, or a subscription changed price. Right now it only says so
when you open the app. Alerts send those facts to you, once, at a sensible
time, through mobile push and email.

---

## 1. Goals and non-goals

**Goals**
- Four alert types (§2), each computed from data that already syncs. No new Plaid products.
- Each alert fires exactly once per real event. A re-sync, a retry or a webhook storm never sends a duplicate.
- Each alert type has its own on/off switch per channel, and thresholds where they make sense.
- Every alert opens the screen that explains it.

**Non-goals (v1)**
- Weekly digest email (the monthly recap covers this for now).
- SMS, Telegram, Slack.
- **Card payment due.** Dropped: Plaid's liabilities data (due date, last payment, statement balance) is too unreliable to say "due in 3 days and not yet paid" with confidence, and a wrong "you haven't paid" alert is worse than none.
- Alerts built on new data: contribution room, safe-to-spend. Those features can later send through this pipeline.
- Anything that needs manual import or AI parsing (product rule: automation only).

---

## 2. Alert types

Amounts follow the existing money rules (DESIGN.md §5.4, §9): true minus sign, CAD default.

| Type | Fires when | Default channels | Example copy | Opens |
|---|---|---|---|---|
| `budget_threshold` | A budget's spend this month crosses **80%**, then **100%**, of its limit (rollover included). | Push | **Dining is at 82%** · $412 of $500 spent, 11 days left. | Budgets (web `/budgets`, mobile Budgets tab) |
| `connection_broken` | A connection turns `error` / `login_required`. | Push + email | **TD Canada Trust needs you to sign in again** · Syncing is paused until you reconnect. | `/accounts` · mobile Accounts |
| `large_transaction` | A new spend transaction is ≥ the user's threshold (default **$500**), **or** is ≥ 3× the merchant's 6-month median and ≥ $100. | Push | **$842.10 at Best Buy** · Amex Cobalt ····1004. | Transaction detail |
| `subscription_change` | Recurring detection finds a **new** subscription, or an existing one's latest charge is ≥ 5% and ≥ $1 more than the previous charge. | Push | **Spotify went up** · $11.99 → $13.99 a month. | `/subscriptions` |

Transfers (`is_transfer`) and income never trigger `large_transaction`. Pending transactions do count, so you hear about a charge as it happens. Dedupe (§4.1) stops the same charge alerting again once it posts.

---

## 3. Where the checks run

There's no new polling. The checks hook into jobs that already run:

| Hook (existing) | Runs |
|---|---|
| `lib/plaidSync.ts`, after a transaction sync adds rows (next to `detectRecurringForUser`) | `large_transaction` for the new rows; `budget_threshold` for the categories they touched; `subscription_change` for streams the re-detection created or updated |
| Webhook `ITEM` error handler (`app/api/plaid/webhook/route.ts`, where `status` is set) and the sync failure path | `connection_broken` |
| **New cron** `/api/cron/alerts`, daily at 13:00 UTC (≈ 9 AM Eastern) | Sends push held back by quiet hours (§5.3); a safety sweep of `budget_threshold` for manual and Shortcuts transactions |

The cron is added to `vercel.json`; Hobby allows daily crons. Every check lives in a pure function in `packages/core/src/alerts.ts` that takes plain rows and returns alert candidates, with unit tests like `budgetMath` and `fireMath`. The web side just loads rows, calls the function and sends what comes back.

---

## 4. Rules in detail

### 4.1 Dedupe (the core guarantee)
Every candidate has a `dedupeKey`. Inserting into `alert_events` with a unique `(user_id, dedupe_key)` index **is** the send lock: insert, and only if a row was actually written, deliver.

| Type | Dedupe key |
|---|---|
| `budget_threshold` | `budget:{categoryId}:{YYYY-MM}:{80\|100}` |
| `connection_broken` | `conn:{itemId}:{errorCode}:{date broken}`, which allows a new alert if it breaks again later |
| `large_transaction` | `txn:{pending_transaction_id ?? plaid_transaction_id}`, so the posted row reuses the pending row's key |
| `subscription_change` | `sub_new:{streamId}` · `sub_price:{streamId}:{newAmountCents}` |

Thresholds are judged on the month in the user's timezone (`currentMonthFor`, v1.13.3).

### 4.2 Budget crossings
Only an actual **crossing** alerts: spend before this sync was below the line, and spend after is at or above it. Raising a budget's limit afterwards doesn't re-arm the alert for that month. Crossing 80% and 100% in one sync sends only the 100% alert, and records 80% as sent.

### 4.3 Large transaction baseline
Merchant median: the last 6 months of that `merchantKey` for the user, excluding transfers. If there are fewer than 3 past charges, only the fixed threshold applies.

### 4.4 Subscription price change
Compare the two most recent charges in the stream's `transactionIds`. If `averageAmount` moved but the latest charge didn't, nothing fires, because that's noise.

---

## 5. Delivery

### 5.1 Push (mobile)
- **Expo Push Service** (`https://exp.host/--/api/v2/push/send`). No new vendor, since the app already ships on EAS (`projectId` in app.json). Batch up to 100 messages per request.
- Each message has a title, a body, and `data.url`, a deep link such as `/budgets` or `/transactions/{id}` that the app routes on tap.
- One Android notification channel, `alerts`, at default importance.
- **Receipts:** a follow-up job checks push receipts. `DeviceNotRegistered` deletes that token.
- iOS needs an APNs key, set up through `eas credentials`. That's a one-time manual step.

### 5.2 Email
- `lib/emailService.ts` (Uplift Send), using the recap's HTML shell in `lib/emailTemplate.ts`.
- One email per alert. Only `connection_broken` emails by default.
- Footer: **Manage alerts** goes to `/settings#alerts`. The one-click unsubscribe reuses `lib/emailUnsubscribe.ts` and turns off email for alerts only (recaps keep their own switch).

### 5.3 Quiet hours
Push sends between **08:00 and 22:00** in the user's timezone. Outside that window the row is written with `deliverAfter` set to the next 08:00, and the daily cron (or the next evaluation) sends it. `connection_broken` follows quiet hours too, since nothing about it is urgent at 3 AM. Email ignores quiet hours, because it doesn't buzz.

### 5.4 Privacy
- New setting: **Show amounts in notifications**, default **on**.
- When it's off, the body drops figures. For example, "Dining is at 82% of its budget" instead of "$412 of $500".
- Lock-screen notifications never include balances or net worth, which matches the hide-amounts rule. None of the four types needs them anyway.

---

## 6. Data model (one migration)

Migration first, code after (see the project's migrations rule): push the migration alone, run `db:migrate`, then ship the code.

```ts
// Expo push tokens, one per device. Deleted on sign-out and on DeviceNotRegistered.
pushTokens = pgTable("push_tokens", {
  id: uuid().primaryKey().defaultRandom(),
  userId: uuid().notNull().references(() => users.id, { onDelete: "cascade" }),
  token: text().notNull().unique(),          // ExponentPushToken[...]
  platform: text().notNull(),                 // "ios" | "android"
  createdAt, lastSeenAt: timestamp(...),
});

// Per-user settings. One row, created on first read with defaults.
alertPreferences = pgTable("alert_preferences", {
  userId: uuid().primaryKey().references(() => users.id, { onDelete: "cascade" }),
  // { budget_threshold: { push: true, email: false }, connection_broken: { push: true, email: true }, ... }
  channels: jsonb().$type<Record<AlertType, { push: boolean; email: boolean }>>().notNull(),
  largeTransactionCents: bigint({ mode: "number" }).notNull().default(50_000),
  showAmounts: boolean().notNull().default(true),
  updatedAt: timestamp(...),
});

// Send log, dedupe lock and history, all in one.
alertEvents = pgTable("alert_events", {
  id: uuid().primaryKey().defaultRandom(),
  userId: uuid().notNull().references(() => users.id, { onDelete: "cascade" }),
  type: alertTypeEnum().notNull(),
  dedupeKey: text().notNull(),
  title: text().notNull(), body: text().notNull(), url: text(),
  payload: jsonb(),                           // ids/amounts used, for debugging
  deliverAfter: timestamp().notNull(),        // quiet hours
  pushSentAt: timestamp(), emailSentAt: timestamp(), readAt: timestamp(),
  createdAt: timestamp().notNull().defaultNow(),
}, (t) => ({ uniq: uniqueIndex().on(t.userId, t.dedupeKey) }));
```

---

## 7. API

| Route | Purpose |
|---|---|
| `GET/PATCH /api/alerts/preferences` | Read and update channels, threshold, showAmounts |
| `POST /api/push-tokens` · `DELETE /api/push-tokens` (token in the body) | Register on permission grant; remove on sign-out |
| `GET /api/alerts?limit=50` | History, newest first |
| `POST /api/alerts/:id/read` | Mark read (mobile tap, web click) |
| `POST /api/alerts/test` | Send a sample of one type to yourself, using the existing recaps "send test" pattern |
| `GET /api/cron/alerts` | Daily job (cron-authenticated) |

---

## 8. UI

### Web: Settings → Alerts (`/settings#alerts`)
- A table with one row per alert type: name, one-line description, and Push / Email switches. Push shows "No devices" until a phone registers.
- **Large purchase threshold:** an amount input, CAD, default $500.
- **Show amounts in notifications:** a switch.
- **Send a test alert:** a button.
- **Recent alerts:** the last 20 from `alert_events`. Each row has the type icon, title, relative time, and a link.

### Mobile
- Settings → **Alerts** screen with the same switches. The iOS permission prompt appears when you first turn on a push switch, **not** at launch. If permission is denied, the screen shows a **Turn on in Settings** link to the OS.
- Tapping a notification deep-links using `data.url`, and marks the alert read.
- No inbox screen in v1. History lives on web.

---

## 9. Build plan

1. **Migration:** the three tables and `alertTypeEnum`, pushed alone, then `db:migrate`.
2. **Core:** `packages/core/src/alerts.ts`, the pure checks plus unit tests for every rule in §4 (crossing edges, pending → posted keying, the median baseline with fewer than 3 points, the price-change noise case).
3. **Engine and email:** `lib/alerts/` (load rows → check → insert-or-skip → deliver), hooked into the sync and webhook paths, the new cron and the email template. **Ship and verify with email only.**
4. **Web settings, history and test send.**
5. **Mobile push (Android only for now):** no paid Apple Developer account, so iOS can't get an APNs key (or universal links); email is the iOS channel until that changes. Then `expo-notifications`, token registration, Settings → Alerts, deep links. This is a **native module, so it needs a new EAS build** (an OTA update can't add it), and on iOS an APNs key, which needs a paid Apple Developer account.
6. Changelog entries; DESIGN.md gets an "Alerts" copy section.

Steps 1–4 are web-only and can ship without waiting on an app store build.

---

## 10. Testing

- Unit tests (core): every rule in §4, every dedupe key, quiet-hours math across DST changes (`America/Toronto` in March and November).
- Integration: a sync that runs twice sends once. A pending charge that posts sends once. Crossing 100% straight from 70% sends one alert.
- Manual: the test-send button for each type, on iOS and Android, with the app foregrounded, backgrounded and killed.
- Mock mode (`lib/mock`): fixtures that trigger each type, so the flow can be demoed without live Plaid.

---

## 11. Decisions to confirm

1. Default large-purchase threshold: **$500**?
2. Pending transactions trigger `large_transaction`: **yes**?
3. Quiet hours **08:00–22:00**, fixed in v1 (no setting)?
4. Default email only for `connection_broken`?
5. Show amounts in notifications defaults to **on**?
