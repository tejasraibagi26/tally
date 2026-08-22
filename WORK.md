# WORK.md — Build Brief: "Tally" Personal Finance Automation

> Working name: **Tally**. Rename freely — it appears in `DESIGN.md` too.
>
> **How to use this file**
> - **§1** is a copy-paste prompt. Paste it into Claude Code (or an agent session) in an empty repo. It references this file, so keep `WORK.md` and `DESIGN.md` in the repo root.
> - **§2–§15** are the actual specification. The prompt is deliberately short because the spec lives here — don't inline it.
> - `DESIGN.md` is the visual spec sheet. Paste **its** §1 into Claude Design to get a clickable prototype before any code is written.

---

## 1. The master prompt (copy-paste this)

```text
Build "Tally", a self-hosted personal finance dashboard that connects to my real
accounts through Plaid, syncs everything automatically, and shows me where my money
is going for the current month.

Read WORK.md and DESIGN.md in the repo root before writing any code. WORK.md is the
functional and integration spec; DESIGN.md is the design system (tokens, type,
color, component and chart rules). Follow both. Where they conflict, WORK.md wins on
behavior and DESIGN.md wins on appearance.

Scope of the product:
- I connect checking/savings, credit cards, and brokerage accounts via Plaid Link.
- The app pulls balances, transactions, credit card liabilities (APR, statement
  balance, minimum payment, due date), and investment holdings + investment
  transactions, and keeps them fresh without me clicking anything.
- Everything is categorized automatically, with rules I can override once and have
  stick forever.
- A dashboard shows: net worth, this month's spend vs. budget, cash flow, spending
  by category and merchant, upcoming bills, credit utilization, and portfolio
  allocation and performance.
- I can set monthly budgets per category and see burn-down mid-month.
- Recurring charges and subscriptions are detected and listed.

Hard requirements:
- TypeScript everywhere. Money is stored as integer minor units (cents), never floats.
- Plaid access tokens are encrypted at rest and NEVER reach the browser.
- Transaction sync uses /transactions/sync with a persisted cursor, is idempotent,
  and correctly handles added/modified/removed plus pending -> posted transitions.
- Webhooks are signature-verified before being trusted, and are processed through a
  queue, not inline in the request handler.
- Sandbox-first: the whole app must be demoable end-to-end against Plaid Sandbox with
  seeded data before production credentials exist.

Work in the milestones defined in WORK.md §12, in order. At the end of each
milestone, stop and show me: what works, how to run it, and the acceptance criteria
you verified. Do not skip ahead. Do not stub Plaid behind fake data beyond the
seed/fixture layer described in §13.

Start by proposing the repo structure and the database schema (WORK.md §5) for my
review, then build Milestone 0 and Milestone 1.
```

**Optional add-ons** — append to the prompt only if you want them:

- `Also add a monthly email/Telegram digest as described in WORK.md §8.4.`
- `Also support manual accounts (cash, assets like a car or property) that have no Plaid connection, so net worth is complete.`
- `Also support multi-currency with a daily FX rate snapshot; display currency is a user setting.`

---

## 2. Product definition

**One-liner.** A private, automated ledger of every account I own, with a month-centric budget view and enough portfolio detail that I never open five apps to answer "how am I doing?"

**Primary user.** Me — one household, 5–20 connected accounts, 300–2,000 transactions/month, comfortable running a small self-hosted app.

**Jobs to be done**

| # | Job | Success looks like |
|---|-----|--------------------|
| J1 | "Am I on track this month?" | Overview answers it in under 5 seconds, no clicking |
| J2 | "Where did the money actually go?" | Category + merchant breakdown, drill to raw transactions |
| J3 | "What's about to hit my card?" | Upcoming bills, statement balance, due dates, minimum payments |
| J4 | "What am I worth?" | Net worth incl. brokerage, with 12-month trend |
| J5 | "Stop making me do data entry" | Zero manual categorization after the first month of rules |

**Non-goals (v1).** Money movement (no Plaid Transfer/ACH), tax prep, bill pay, shared/multi-user households, mobile native apps, crypto exchange aggregation, invoicing.

---

## 3. Scope

### In scope
- Plaid Link (incl. OAuth institutions) + update-mode re-authentication
- Account types: `depository` (checking/savings), `credit`, `investment`/brokerage, `loan`
- Transactions sync, enrichment, categorization, rules, splits, notes, tags
- Investment holdings, securities, investment transactions, cost basis, allocation
- Liabilities: credit APRs, statement balance, min payment, due date, overdue flag
- Budgets (monthly, per category, rollover optional), recurring detection
- Dashboard + drill-downs, CSV/JSON export
- Automated scheduled sync + webhook-driven sync, connection-health surface

### Explicitly out of scope
- Anything that moves money
- Anything that sends financial data to a third-party LLM/analytics service by default
- Multi-tenant SaaS concerns (billing, orgs, RBAC) — single-owner app, but keep the schema `user_id`-scoped so it *could* grow

---

## 4. Tech stack

| Layer | Choice | Why / notes |
|---|---|---|
| App | **Next.js (App Router) + TypeScript** | One deployable, server actions + route handlers for Plaid, RSC for dashboard reads |
| UI | **Tailwind CSS + shadcn/ui**, tokens from `DESIGN.md` | Wire DESIGN.md tokens into `tailwind.config.ts` as the *source of truth*; don't hand-pick colors in components |
| Charts | **Recharts** (or visx if you need custom marks) | Chart rules in `DESIGN.md` §7 are binding |
| DB | **PostgreSQL** (Neon / Supabase / local Docker) | Needs `bigint`, `numeric`, JSONB, partial indexes |
| ORM | **Drizzle ORM** + drizzle-kit migrations | Typed, SQL-shaped, readable migrations |
| Auth | **Auth.js (email magic link)** or Clerk | Single user, but real sessions — this app holds your entire financial life |
| Jobs/queue | **Inngest** (hosted) *or* pg-boss (self-hosted, Postgres-backed) | Needed for webhook fan-out, retries, backfills |
| Plaid | **`plaid` official Node SDK** | Server-side only |
| Secrets | Env vars + envelope encryption (KMS or local master key) | See §11 |
| Testing | Vitest + Playwright + Plaid Sandbox | See §13 |
| Deploy | Vercel + Neon, or a single Docker Compose (app + postgres + worker) | Pick one and document it in the README |

> **Rule:** no financial computation in the browser. All aggregates come from the server so the numbers are identical everywhere.

---

## 5. Data model

Money is `bigint` **minor units** (cents). Every monetary column stores the amount *and* its `iso_currency_code`. Sign convention is defined once, in §7.3, and never re-litigated per-table.

```
users                 id, email, name, timezone, base_currency, created_at
plaid_items           id, user_id, plaid_item_id, institution_id, institution_name,
                      access_token_ciphertext, access_token_dek, status
                      (healthy|login_required|pending_expiration|revoked|error),
                      last_error_code, consented_products[], available_products[],
                      transactions_cursor, last_synced_at, created_at
institutions          id (plaid), name, logo_base64, primary_color, url, oauth
accounts              id, user_id, item_id, plaid_account_id, name, official_name,
                      mask, type, subtype, currency, is_hidden, is_manual,
                      current_balance, available_balance, credit_limit,
                      balance_as_of, created_at
account_balances      id, account_id, as_of_date, current, available, limit   -- daily snapshot
transactions          id, user_id, account_id, plaid_transaction_id UNIQUE,
                      pending_transaction_id, is_pending, amount, currency,
                      posted_date, authorized_date, name, merchant_name,
                      merchant_entity_id, logo_url, website, payment_channel,
                      pfc_primary, pfc_detailed, pfc_confidence,
                      category_id (FK categories), category_source
                      (plaid|rule|manual|ml), counterparties JSONB, location JSONB,
                      notes, tags[], is_transfer, transfer_group_id,
                      excluded_from_budget, raw JSONB, created_at, updated_at
transaction_splits    id, transaction_id, category_id, amount, note
categories            id, user_id NULL(=system), parent_id, name, slug, icon,
                      color_slot, kind (income|expense|transfer|ignore), sort_order
rules                 id, user_id, priority, enabled, match JSONB
                      (field, op, value — name/merchant/amount range/account/pfc),
                      actions JSONB (set_category, add_tag, rename, exclude,
                      mark_transfer, split), applies_to_existing, created_at
budgets               id, user_id, month (date, 1st), category_id, amount,
                      rollover_enabled, rollover_from_prior
securities            id, plaid_security_id UNIQUE, ticker, cusip, isin, name,
                      type, is_cash_equivalent, close_price, close_price_as_of,
                      currency, sector, asset_class
holdings              id, account_id, security_id, quantity numeric(28,10),
                      cost_basis, institution_price, institution_price_as_of,
                      institution_value, as_of_date
                      -- UNIQUE (account_id, security_id, as_of_date)
investment_transactions id, account_id, plaid_investment_transaction_id UNIQUE,
                      security_id, date, name, quantity, amount, price, fees,
                      type, subtype, currency
liabilities_credit    id, account_id, aprs JSONB, is_overdue, last_payment_amount,
                      last_payment_date, last_statement_balance,
                      last_statement_issue_date, minimum_payment_amount,
                      next_payment_due_date, as_of
recurring_streams     id, user_id, merchant_key, description, account_id,
                      category_id, average_amount, frequency
                      (weekly|biweekly|monthly|quarterly|annual), last_date,
                      predicted_next_date, status (active|at_risk|cancelled),
                      confidence, transaction_ids[]
net_worth_snapshots   id, user_id, as_of_date, assets, liabilities, net,
                      breakdown JSONB    -- one row per user per day
webhook_events        id, provider, item_id, webhook_type, webhook_code,
                      payload JSONB, signature_verified, received_at,
                      processed_at, status, attempts, error
sync_runs             id, item_id, kind (transactions|holdings|inv_tx|liabilities|
                      balances), trigger (webhook|cron|manual|initial),
                      started_at, finished_at, added, modified, removed, error
audit_log             id, user_id, action, entity, entity_id, before, after, at
```

**Indexes that matter:** `transactions (user_id, posted_date DESC)`, `transactions (account_id, posted_date)`, partial `transactions (user_id) WHERE is_pending`, `holdings (account_id, as_of_date)`, `budgets (user_id, month)`, unique on every `plaid_*_id`.

---

## 6. Plaid integration playbook

> Everything here is server-side. `PLAID_SECRET` and `access_token` never leave the server. Verify current endpoint behavior against Plaid's docs at build time — this is the intended design, not a substitute for the API reference.

### 6.1 Products to request

| Product | Gives you | Notes |
|---|---|---|
| `transactions` | Bank + credit card transactions, balances, PFC categories | Core |
| `investments` | Holdings, securities, investment transactions | Brokerages; coverage varies by institution |
| `liabilities` | Credit card APR, statement balance, min payment, due date | Credit cards, student loans, mortgages |
| `auth`, `identity` | Account/routing numbers, account holder name | **Skip in v1** — you're not moving money |

Request `transactions` as the initializing product and pass the others via `additional_consented_products` (consent captured once, so you can enable them later without a re-link) and/or `required_if_supported_products` for institutions that support them. Never request a product you don't use — it slows Link and widens consent.

### 6.2 Link flow

1. `POST /api/plaid/link-token` → server calls **`/link/token/create`** with `user.client_user_id` (your internal user id, stable), `client_name`, `products`, `country_codes`, `language`, `webhook` (your public webhook URL), `redirect_uri` (required for OAuth institutions), optional `account_filters`.
2. Client opens Plaid Link with that token (`react-plaid-link`).
3. `onSuccess(public_token, metadata)` → `POST /api/plaid/exchange` → **`/item/public_token/exchange`** → store `access_token` **encrypted** + `item_id`.
4. Immediately: **`/accounts/get`** to create `accounts` rows, **`/institutions/get_by_id`** (with `include_optional_metadata`) for logo + brand color, then enqueue an initial sync job per product.
5. `onExit(err, metadata)` → log `link_session_id`, `request_id`, `institution` for support.

**OAuth institutions** (most large US banks) redirect out of the browser. Implement the `redirect_uri` round-trip and Link's `receivedRedirectUri` re-initialization, and register the exact URI in the Plaid dashboard. Test against a Sandbox OAuth institution before assuming it works.

**Update mode** (re-auth after `ITEM_LOGIN_REQUIRED`): create a link token with `access_token` set and no `products`; add `update: { account_selection_enabled: true }` when the user should also add/remove accounts.

### 6.3 Transactions — the sync algorithm

Use **`/transactions/sync`**, not `/transactions/get`. Store `next_cursor` on `plaid_items`.

```
syncTransactions(item):
  lock item                       # advisory lock keyed on item id — no concurrent syncs
  cursor = item.transactions_cursor        # null on first run = full history
  added, modified, removed = [], [], []
  loop:
    res = plaid.transactionsSync({ access_token, cursor, count: 500,
            options: { include_personal_finance_category: true,
                       include_original_description: true } })
    accumulate res.added / res.modified / res.removed
    cursor = res.next_cursor
    if not res.has_more: break
  in ONE db transaction:
    upsert added + modified by plaid_transaction_id
    delete (or soft-delete) removed by plaid_transaction_id
    reconcile pending: for each posted tx with pending_transaction_id,
        carry over the pending row's category/notes/tags/splits, then remove
        the pending row
    run rules engine over new/changed rows (§7.2)
    write item.transactions_cursor = cursor
    write sync_runs row
  release lock
```

**Non-negotiables**
- Advance the cursor **only after** the DB transaction commits. A crash mid-loop must replay, not skip.
- Upserts are keyed on `plaid_transaction_id` and must be idempotent — the same page replayed twice changes nothing.
- Never overwrite user-owned fields (`category_id` when `category_source != 'plaid'`, `notes`, `tags`, splits) on a `modified` event.
- On the first sync, expect several pages and up to ~24 months of history; show a "still importing" state rather than an empty dashboard.

**Fields worth keeping:** `merchant_name`, `merchant_entity_id`, `logo_url`, `website`, `payment_channel`, `authorized_date` vs `date`, `personal_finance_category.{primary,detailed,confidence_level}`, `counterparties`, `location`, `original_description`. Persist the whole payload in `raw` JSONB — you *will* want a field you didn't map.

### 6.4 Investments / brokers

- **`/investments/holdings/get`** → `accounts`, `holdings`, `securities`. Upsert securities first (`plaid_security_id`), then holdings as a **dated snapshot** (`as_of_date = today`), so allocation history is queryable instead of overwritten.
- **`/investments/transactions/get`** → paginated via `count`/`offset` against `total_investment_transactions`; loop until all are fetched. Types include `buy`, `sell`, `cash`, `fee`, `transfer` (dividends arrive as a subtype). Use these for realized flows and contribution tracking.
- Cost basis is best-effort and institution-dependent. Label it "reported by institution" and never derive tax lots from it.
- Cash inside a brokerage arrives as a security with `is_cash_equivalent = true` — count it as cash in allocation, not as an equity position.
- **Coverage reality:** Plaid Investments does not cover every broker, and some are OAuth-only or holdings-only (no investment transactions). Degrade gracefully: if an account has holdings but no investment transactions, hide its activity tab rather than showing an empty one.

### 6.5 Credit cards

- Credit cards arrive as regular `accounts` with `type = credit` — their charges flow through `/transactions/sync` like any other account.
- **`/liabilities/get`** adds the card-specific facts: `aprs[]` (purchase / cash advance / balance transfer, each with `balance_subject_to_apr`), `last_statement_balance`, `last_statement_issue_date`, `minimum_payment_amount`, `next_payment_due_date`, `is_overdue`, `last_payment_amount/date`.
- **Utilization** = `current_balance / credit_limit` per card, and aggregated across cards. The limit comes from `accounts.balances.limit`; if it's null, mark utilization "unknown" — do not guess.
- Card payments are **transfers**, not spend. Detect them (§7.4) or you will double-count every month.

### 6.6 Balances

`/accounts/balance/get` forces a fresh pull from the institution (slower, rate-limited). Use it on manual refresh, once nightly for the net-worth snapshot, and after a `DEFAULT_UPDATE`. Otherwise read the balances that come back with sync.

### 6.7 Webhooks

Single endpoint `POST /api/plaid/webhook`:

1. **Verify** — read the `Plaid-Verification` JWT header, fetch the key via **`/webhook_verification_key/get`** using the JWT's `kid` (cache keys), verify the ES256 signature, confirm the body's SHA-256 matches the JWT's `request_body_sha256` claim, and reject anything with `iat` older than ~5 minutes.
2. **Persist** the raw event to `webhook_events`, respond **200 immediately**.
3. **Enqueue** a job. All real work happens in the worker, with retries and dedupe.

| `webhook_type` | `webhook_code` | Action |
|---|---|---|
| TRANSACTIONS | `SYNC_UPDATES_AVAILABLE` | Run the §6.3 sync for the item (primary trigger) |
| TRANSACTIONS | `INITIAL_UPDATE` / `HISTORICAL_UPDATE` / `DEFAULT_UPDATE` | Legacy path — still run sync; treat as a hint |
| TRANSACTIONS | `TRANSACTIONS_REMOVED` | Handled by sync's `removed[]`; log only |
| HOLDINGS | `DEFAULT_UPDATE` | Refresh holdings snapshot |
| INVESTMENTS_TRANSACTIONS | `DEFAULT_UPDATE` / `HISTORICAL_UPDATE` | Refresh investment transactions |
| LIABILITIES | `DEFAULT_UPDATE` | Refresh liabilities |
| ITEM | `ERROR` | Set item status from `error.error_code`; if `ITEM_LOGIN_REQUIRED`, surface re-auth |
| ITEM | `PENDING_EXPIRATION` / `PENDING_DISCONNECT` | Warn user; prompt update-mode re-auth *before* it breaks |
| ITEM | `USER_PERMISSION_REVOKED` | Mark item revoked, stop syncing, offer delete |
| ITEM | `NEW_ACCOUNTS_AVAILABLE` | Prompt update mode with account selection |
| ITEM | `WEBHOOK_UPDATE_ACKNOWLEDGED` | Log |

Local development: tunnel with ngrok/cloudflared and use **`/sandbox/item/fire_webhook`** to trigger events on demand.

### 6.8 Error handling & item health

| Error code | Meaning | Handling |
|---|---|---|
| `ITEM_LOGIN_REQUIRED` | Credentials/MFA stale | Item → `login_required`, banner + update-mode Link, pause syncs |
| `PENDING_EXPIRATION` | Consent expiring | Proactive re-auth prompt |
| `PRODUCT_NOT_READY` | Data still being pulled | Retry with backoff (30s → 5m); don't surface as an error |
| `RATE_LIMIT_EXCEEDED` | Too many calls | Exponential backoff + jitter; per-item concurrency of 1 |
| `INSTITUTION_DOWN` / `INSTITUTION_NOT_RESPONDING` | Bank-side | Retry later; show "bank unavailable", not "your fault" |
| `INVALID_ACCESS_TOKEN` / `ITEM_NOT_FOUND` | Item gone | Mark dead, require re-link |
| `NO_INVESTMENT_ACCOUNTS` / `PRODUCTS_NOT_SUPPORTED` | Institution lacks product | Disable that product for the item, hide its UI |

Every Plaid call logs `request_id` — it's the only thing Plaid support will ask for. Never log `access_token`; redact `account_id`/`mask` in shared logs.

### 6.9 Environments, limits, cost

- **Sandbox** — free, unlimited, deterministic. Test credentials `user_good` / `pass_good`; MFA via `mfa_device`; `/sandbox/public_token/create` skips Link entirely for tests; `/sandbox/item/reset_login` forces `ITEM_LOGIN_REQUIRED`; custom Sandbox users let you script exact transaction sets.
- **Production** requires an approved Plaid dashboard application and is **billed per item/product** — Transactions and Investments price separately. Check current pricing and whether a free/limited production tier applies to you before connecting real accounts. Plaid retired the old "Development" environment, so the path is Sandbox → Production.
- Keep per-item sync concurrency at 1, stagger cron across items, and cache institution metadata — it effectively never changes.

---

## 7. Categorization, rules, and money semantics

### 7.1 Category taxonomy
Seed from Plaid's **Personal Finance Category** taxonomy (`primary` → `detailed`, plus `confidence_level`) as system categories, then let the user rename, merge, hide, and add children. Store both the raw PFC values *and* the resolved `category_id` so a re-map is always possible. `category_source` records who decided: `plaid` < `ml` < `rule` < `manual` (higher always wins).

### 7.2 Rules engine
Ordered by `priority`, first match wins per action type. Match on: description contains/regex, merchant equals, amount range, account, PFC primary/detailed, direction. Actions: set category, add tag, rename display, exclude from budget, mark as transfer, split by fixed amounts or percentages. Every rule offers **"apply to existing transactions"** with a preview count before it commits. Editing a transaction's category offers "always categorize *Merchant X* this way" — that's how the rule table actually gets populated.

### 7.3 Sign convention (define once, obey everywhere)
Plaid returns **positive = money leaving** the account for depository accounts. Normalize on ingest and store it normalized:

- Internal: **expenses negative, income positive**, for every account type.
- Credit cards: a purchase is negative (spend); a payment to the card is positive on the card and negative on the funding account — both flagged `is_transfer`.
- Display flips sign only in views that present spend as a positive magnitude (e.g. a category bar chart), and those views must be labeled "Spend".

### 7.4 Transfer detection
Pair transactions across accounts when: opposite signs, `|amount|` equal (±1%), dates within 4 days, and either the pair is card↔bank or both accounts are user-owned. Group under `transfer_group_id`, set `is_transfer = true`, and exclude from income, spend, and budgets. Surface a "possible transfers" review list rather than silently guessing.

### 7.5 Recurring detection
Cluster by normalized merchant + account + amount band. Require ≥3 occurrences with a stable interval (±4 days) to promote to a `recurring_stream`. Predict the next date; if a stream misses its window by >10 days mark it `at_risk`, and after 2 misses `cancelled`. Surface as "Subscriptions" with an annualized total — that's the number that makes people cancel things.

---

## 8. Automation

### 8.1 Triggers
- **Webhook-driven** (primary): `SYNC_UPDATES_AVAILABLE` → sync that item within seconds.
- **Cron safety net:** every item synced at 06:00 and 18:00 local; a nightly 02:00 job for balance refresh, holdings snapshot, liabilities, net-worth snapshot, recurring re-detection, and budget rollover on the 1st.
- **Manual:** a "Refresh" button per item with a visible last-synced timestamp and a 60-second client-side cooldown.

### 8.2 Job hygiene
Idempotent by `(item_id, kind, cursor|date)`. Exponential backoff with jitter, max 5 attempts, dead-letter into `sync_runs` with the error. One in-flight sync per item (advisory lock). Every run writes a `sync_runs` row — the Connections screen reads from it.

### 8.3 Freshness contract (shown in UI)
`Fresh` < 6h · `Stale` 6–48h · `Needs attention` > 48h or item error. Never show a number without letting the user find out how old it is.

### 8.4 Notifications (optional)
Weekly digest (spend vs budget, top merchants, net worth delta), large-transaction alert over a threshold, budget 80%/100% crossings, card due date T-3 days, and connection-broken alerts. Email via Resend, or a Telegram bot — both are a single outbound webhook.

---

## 9. Dashboard — metric definitions

Compute server-side. Ambiguity here is what makes finance dashboards untrustworthy, so pin it down:

| Metric | Definition |
|---|---|
| **Net worth** | Σ depository + investment balances − Σ credit + loan balances, as of the latest snapshot. Manual assets included if enabled. |
| **Month spend** | Σ absolute value of expense-kind, non-transfer, non-excluded transactions with `posted_date` in the user's local month. Pending included, flagged. |
| **Income** | Σ income-kind, non-transfer transactions in the month. |
| **Cash flow** | Income − spend, per month, 13-month trailing series. |
| **Budget remaining** | `budget.amount − spend(category, month)` (+ rollover if enabled). Over-budget shows a negative remaining, never clamped to zero. |
| **Burn rate / projection** | `spend_to_date / days_elapsed × days_in_month`, drawn as a projection marker with an explicit "projected" label. |
| **Credit utilization** | `Σ credit balances / Σ credit limits`; cards with unknown limit excluded from both sides and counted in a footnote. |
| **Portfolio value** | Σ `institution_value` of the latest holdings snapshot per investment account. |
| **Allocation** | Latest holdings grouped by `security.type` / asset class; cash equivalents as their own slice. |
| **Portfolio return** | Simple: value change over the period minus net contributions (from investment transactions). Label it as simple return — do not silently claim IRR/TWR. |
| **Upcoming bills** | `recurring_streams.predicted_next_date` within 30 days + `liabilities_credit.next_payment_due_date`. |

Every metric card links to the transaction list filtered to exactly the rows that produced it. **If you can't drill into it, don't display it.**

---

## 10. API surface

```
POST   /api/plaid/link-token          { mode: "create" | "update", itemId? }
POST   /api/plaid/exchange            { publicToken, metadata }
POST   /api/plaid/webhook             (public; JWT-verified)
DELETE /api/items/:id                 -> /item/remove + cascade delete
POST   /api/items/:id/sync            { kinds?: [...] }   (manual refresh)
GET    /api/accounts
PATCH  /api/accounts/:id              { isHidden, name }
GET    /api/transactions              ?from&to&accounts&categories&search&min&max
                                       &pending&cursor&limit
PATCH  /api/transactions/:id          { categoryId, notes, tags, excluded, splits }
POST   /api/transactions/bulk         { ids, action }
GET    /api/categories                POST / PATCH / DELETE
GET    /api/rules                     POST / PATCH / DELETE  (+ ?preview=1)
GET    /api/budgets?month=YYYY-MM     PUT /api/budgets
GET    /api/investments/holdings      ?asOf
GET    /api/investments/transactions  ?from&to&accounts
GET    /api/liabilities
GET    /api/recurring
GET    /api/analytics/overview        ?month
GET    /api/analytics/cashflow        ?months=13
GET    /api/analytics/categories      ?month&groupBy=category|merchant
GET    /api/analytics/networth        ?range=12m
GET    /api/export                    ?format=csv|json&from&to
```

All list endpoints are cursor-paginated. All money in responses is `{ amount: <cents:number>, currency: "USD" }` — never a pre-formatted string.

---

## 11. Security

1. **Access tokens**: envelope-encrypted (AES-256-GCM data key, wrapped by a KMS key or `MASTER_KEY`). Decrypt only inside the Plaid service module. Never returned by any API, never logged, never in error messages.
2. **No token in the browser, ever.** Link tokens are short-lived and single-purpose; that's the only Plaid string the client sees.
3. **Webhook verification is mandatory** (§6.7). An unverified webhook is discarded, not processed "just in case".
4. **Auth on everything**, including `/api/analytics/*`. Every query is scoped by `user_id` at the ORM layer.
5. **Transport & storage**: HTTPS only, HSTS, DB encrypted at rest, backups encrypted, `raw` JSONB payloads treated as PII.
6. **Logging**: structured, with `request_id`; redact tokens, full account numbers, and masks. No transaction descriptions in third-party error trackers.
7. **Data deletion**: deleting an item calls `/item/remove` *first*, then cascades local deletion. Provide a full "export and wipe" path.
8. **Dependencies**: pin, audit, keep the Plaid SDK current. Document a rotation procedure for `PLAID_SECRET` and `MASTER_KEY`.
9. **Rate-limit** the public webhook endpoint and link-token creation.

---

## 12. Milestones

Each milestone ends with a demo and the listed acceptance criteria verified.

**M0 — Skeleton (½ day)**
Repo, TypeScript, Tailwind wired to `DESIGN.md` tokens, Postgres + Drizzle, auth, empty shell with nav.
✅ Dev server boots, login works, migrations run clean, design tokens visible on a `/styleguide` route.

**M1 — Plaid Link + accounts (1–2 days)**
Link token, exchange, encrypted token storage, `/accounts/get`, institution metadata, accounts screen with item health.
✅ Connect 2 Sandbox institutions incl. one OAuth; accounts render with balances; the access token is ciphertext in the DB; removing an item calls `/item/remove`.

**M2 — Transaction sync (2–3 days)**
`/transactions/sync` with cursor, upserts, pending reconciliation, removed handling, `sync_runs`, transactions table UI with filters/search.
✅ Full historical import completes; re-running sync is a no-op; a pending→posted transition keeps user edits; killing the process mid-sync loses nothing on restart.

**M3 — Webhooks + automation (1–2 days)**
Verified webhook endpoint, queue + worker, cron schedules, freshness badges, re-auth (update mode) flow.
✅ `/sandbox/item/fire_webhook` triggers a sync end-to-end; a tampered webhook body is rejected; `/sandbox/item/reset_login` surfaces the re-auth banner and update-mode Link repairs the item.

**M4 — Categorization, rules, budgets (2–3 days)**
PFC seeding, rules engine + preview, manual overrides that stick, transfer detection, monthly budgets with rollover.
✅ A rule applied to existing transactions re-categorizes exactly the previewed count; a card payment is excluded from spend on both sides; budget math matches a hand-checked month.

**M5 — Investments + liabilities (2 days)**
Holdings snapshots, securities, investment transactions, allocation, credit APR/statement/due-date panel, utilization.
✅ Brokerage value matches the Sandbox institution; allocation sums to 100% with cash as its own slice; a card with a null limit is excluded from utilization and footnoted.

**M6 — Dashboard (2–3 days)**
Overview per §9, cash flow, category/merchant breakdowns, net worth trend, upcoming bills, recurring/subscriptions. Charts per `DESIGN.md` §7.
✅ Every metric drills into its exact transaction set; numbers match the transactions page; dark mode is correct; no dual-axis chart exists anywhere.

**M7 — Hardening (1–2 days)**
Error states, empty states, loading skeletons, export, backups, README runbook, secret-rotation doc, seed/fixture data.
✅ Fresh clone → Sandbox demo in under 10 minutes using only the README.

---

## 13. Testing

- **Unit**: sign normalization, sync reconciliation (added/modified/removed/pending), rules engine, transfer pairing, budget/rollover math, utilization edge cases (null limit, zero limit).
- **Fixtures**: record real Sandbox responses to JSON and replay them — no hand-written fake Plaid payloads that drift from the real schema.
- **Integration**: hit Plaid Sandbox for the real thing; use custom Sandbox users to script exact transaction sets, including a pending transaction that later posts.
- **Webhook tests**: valid signature, expired `iat`, wrong `kid`, tampered body, replayed event (must be idempotent).
- **E2E (Playwright)**: connect → import → categorize → budget → dashboard.
- **Nightly data-integrity check** (alerts on failure): account balances sum to the net-worth snapshot; no orphan transactions; no duplicate `plaid_transaction_id`.

---

## 14. Environment variables

```
DATABASE_URL=
AUTH_SECRET=
APP_URL=https://...

PLAID_CLIENT_ID=
PLAID_SECRET=
PLAID_ENV=sandbox|production
PLAID_PRODUCTS=transactions
PLAID_ADDITIONAL_CONSENTED_PRODUCTS=investments,liabilities
PLAID_COUNTRY_CODES=US
PLAID_REDIRECT_URI=https://.../plaid/oauth
PLAID_WEBHOOK_URL=https://.../api/plaid/webhook

MASTER_KEY=            # 32-byte base64; or KMS_KEY_ID
CRON_SECRET=
INNGEST_EVENT_KEY=     # if using Inngest
RESEND_API_KEY=        # optional notifications
TELEGRAM_BOT_TOKEN=    # optional notifications
```

---

## 15. Decisions to confirm before M1

1. **Hosting**: Vercel + Neon, or Docker Compose on your own box? (Self-hosting keeps every transaction on hardware you control.)
2. **Queue**: Inngest (fastest to build) vs pg-boss (no third party sees job payloads).
3. **Auth**: magic-link email vs. a single passkey.
4. **Month boundary**: calendar month, or a custom cycle aligned to your pay date?
5. **Rollover budgets**: on or off by default.
6. **Retention**: keep `raw` Plaid payloads indefinitely, or prune after 90 days?
7. **Base currency**, and whether multi-currency is needed at all in v1.

---

### Appendix — prompt for the design prototype

Open Claude Design and paste **§1 of `DESIGN.md`**. It carries the screen inventory and the full token sheet, and produces a prototype you can react to before any of the above gets built.
