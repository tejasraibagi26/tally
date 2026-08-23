# Tally

A private finance dashboard — see `WORK.md` for the full spec and milestone plan, `DESIGN.md` for the design system. All eight milestones in `WORK.md` §12 (M0–M7) are built. This README is the runbook: a fresh clone should reach a working Sandbox demo in under 10 minutes following **Run it** below.

## What's built

- **App shell**: Next.js App Router + TypeScript, Tailwind wired to the `DESIGN.md` token set, Inter/Instrument Serif/JetBrains Mono, light + dark mode, `/styleguide` route showing every token and component live.
- **Auth**: NextAuth v5 with a single seeded admin user (bcrypt-hashed password), edge-safe middleware guarding every route except `/login` and the Plaid webhook.
- **Database**: full Drizzle schema (`db/schema.ts`) for the whole product per `WORK.md` §5, with an initial migration generated.
- **Plaid Link**: create + update (re-auth) modes, OAuth institution redirect round-trip (`/plaid/oauth`), encrypted access-token storage (AES-256-GCM envelope encryption, `lib/crypto.ts`), account + institution sync on exchange, item removal via `/item/remove`, webhook endpoint with full JWT signature verification.
- **Transaction sync**: `/transactions/sync` with a persisted cursor, idempotent upserts, pending→posted reconciliation that preserves user edits, and `removed[]` handling (`lib/plaidSync.ts`).
- **Webhooks + automation (M3)**: verified webhooks (`app/api/plaid/webhook/route.ts`) process the matching sync inline within the request — no queue/worker process (Vercel Functions don't support a persistent listener, and one item's sync takes a few seconds); a nightly job refreshes balances as a native Vercel Cron Job (`vercel.json` → `app/api/cron/nightly`, authenticated via `CRON_SECRET`). The twice-daily transactions safety net (`app/api/cron/sync-all`) runs on Upstash QStash instead (`scripts/setup-qstash-schedule.ts`) — Vercel Hobby caps native Cron Jobs at once/day — authenticated via QStash's signed-request verification (`lib/cronAuth.ts`); the route also still accepts a native Vercel-cron GET in case a future Pro plan re-adds it to `vercel.json`. Both mechanisms run in UTC (no per-project timezone). `webhook_events` and `sync_runs` track every attempt.
- **Accounts & Connections** screen: real data, a freshness badge per §8.3 (Fresh < 6h · Stale 6–48h · Needs attention > 48h, or broken regardless of age), reconnect flow (update-mode Link), manual balance + transaction refresh.
- **Categorization, rules, budgets (M4)**: system categories seeded from Plaid's PFC taxonomy (`npm run seed:categories`); a rules engine (`lib/rulesEngine.ts`) that matches on description/merchant/amount/account/PFC/direction and sets category/tags/exclude/transfer/split, with priority ordering and a preview count before "apply to existing" commits; transfer pairing (`lib/transferDetection.ts`) that auto-excludes matched pairs (e.g. a card payment and its funding-account debit) from spend on both sides; manual category edits on a transaction (with an optional "always categorize this merchant" one-click rule) that sync can never overwrite; monthly budgets with optional rollover and a burn-down view at `/budgets`. A `/rules` screen manages rules (linked from Transactions).
- **Investments + liabilities (M5)**: holdings/securities snapshots and investment transactions via `/investments/holdings/get` + `/investments/transactions/get` (`lib/plaidInvestments.ts`), credit card APR/statement/due-date via `/liabilities/get` (`lib/plaidLiabilities.ts`) — both wired into initial link, manual sync, webhooks (`HOLDINGS`/`INVESTMENTS_TRANSACTIONS`/`LIABILITIES`), and the nightly cron. `/investments` shows portfolio value, allocation (cash as its own slice), per-account holdings, and recent activity; `/cards` shows APR/statement/min payment/due date and utilization, with a null-limit card excluded from the ratio and footnoted (§6.5). Both institutions and account types that don't support these products degrade quietly rather than erroring (§6.4).
- **Dashboard (M6)**: `/overview` — hero net-worth card with a 12-month trend chart, four stat tiles (spend/income/cash-flow/utilization, each with a vs.-last-month delta), a 13-month cash-flow chart (diverging bars from a zero baseline), a budget burn-down list, a ranked "where it went" category breakdown, upcoming bills (subscriptions + card due dates within 30 days), and recent activity. Recurring/subscription detection (`lib/recurringDetection.ts`) clusters by merchant+account+amount band and needs ≥3 stable-interval occurrences before it promotes a stream; `/subscriptions` lists them with monthly/annualized totals. Nightly net-worth snapshots (`lib/networth.ts`) back the trend chart. Every chart uses the `DESIGN.md` §7 series palette via CSS custom properties (so dark mode needs no separate handling) and there is no dual-axis chart anywhere. `/api/analytics/*`, `/api/recurring`, and `/api/export` (CSV/JSON) round out the API surface from `WORK.md` §10.
- **Hardening (M7)**: `error.tsx` boundaries (app shell + root) instead of Next's default crash screen; `loading.tsx` skeletons (shape-matched `--sunken` blocks, no full-page spinners) on every data-heavy screen; an Export card in Settings; a `MASTER_KEY` rotation script; this runbook, kept current milestone by milestone.
- **Mock mode**: runs the whole app with zero Plaid credentials — see below.

Known simplifications, by milestone:
- **M4**: no category "hide" (no schema field for it), no category merge UI, transfer pairs auto-apply rather than going through a review queue first (`lib/transfers.ts`, `app/api/categories/[id]/route.ts`).
- **M5**: mortgage/student-loan liabilities aren't tracked (schema only has `liabilities_credit`, matching v1 scope); `/api/investments/holdings?asOf` doesn't do a historical lookup yet — there's no snapshot history to query on a fresh install; "Portfolio return"'s net-contributions math (`lib/portfolio.ts`) is implemented from Plaid's documented sign convention but **not verified against live Sandbox investment transactions** — check it against a real transfer before trusting the number.
- **M6**: no virtualized transaction table, side panel, or `j/k/c/x//` keyboard shortcuts (§10.2); no 1M/3M/YTD/1Y/All performance switcher on Investments (§10.5); no mobile bottom-tab layout (§10 "Mobile"); no toasts (sync completion/failure still surface via the freshness badge and banners, just not a toast). Net worth and portfolio-return trends are only as long as the snapshot history that's accumulated since this milestone shipped — a fresh install has one data point.
- **M7**: no automated Sandbox-fixture recording (`WORK.md` §13's "record real Sandbox responses to JSON and replay them") — the existing mock fixtures (`lib/mock/*Fixtures.ts`) are hand-authored dev/demo data, not a substitute for that test infrastructure; there's no CI pipeline running `typecheck`/`vitest`/`build` on push, only the local scripts below.

## Run it

### 1. Start Postgres

```bash
docker compose up -d
```

(No Docker? Install Postgres locally and point `DATABASE_URL` at it instead.)

### 2. Configure environment

```bash
cp .env.example .env
```

Fill in `AUTH_SECRET` (`npx auth secret`) and `MASTER_KEY` (`openssl rand -base64 32`). Leave `PLAID_*` blank for now — mock mode doesn't need them.

### 3. Migrate and seed a user

```bash
npm install
npm run db:migrate
ADMIN_EMAIL=you@example.com ADMIN_PASSWORD=your-password-here npm run seed:user
npm run seed:categories
```

(Or set `ADMIN_EMAIL`/`ADMIN_PASSWORD` in `.env` first, then just `npm run seed:user`.) `seed:categories` is idempotent — safe to re-run after pulling changes to `lib/categoryTaxonomy.ts`; it only adds what's missing and never touches a category you've already renamed. Without it, transactions still sync fine but land with no default category until you run it.

### 4. Run the app

```bash
npm run dev
```

Visit `http://localhost:3000`, sign in, and go to **Accounts**. In dev, **Mock data** is on by default (see below) — "Add account" instantly connects a fixture institution, no Plaid account needed.

Automatic sync (twice-daily safety net + nightly balance refresh) runs as Vercel Cron Jobs in production (`vercel.json`) — there's no separate worker process to run locally. Webhook-triggered syncs process inline in `/api/plaid/webhook` itself. The app's manual "Sync now" buttons always work regardless.

## Mock mode

`lib/config.ts` resolves `MOCK_MODE`: **dev defaults to mock, production defaults to live.** Override explicitly with `MOCK_DATA=true` / `MOCK_DATA=false` in `.env` in either direction (e.g. to exercise real Plaid Sandbox while developing).

In mock mode, "Add account" calls `/api/mock/connect` instead of opening Plaid Link, inserting one of three canned institutions (`lib/mock/fixtures.ts`) with realistic checking/savings/credit/brokerage accounts and balances directly into Postgres. Everything downstream — balances, health badges, delete, the Overview net worth figure — reads real DB rows, so it exercises the same code paths mock or live. A "Mock data" chip appears in the top bar whenever it's active so it's never mistaken for a real connection.

## Switching to live Plaid Sandbox

1. Get Sandbox credentials from the [Plaid dashboard](https://dashboard.plaid.com).
2. Set `PLAID_CLIENT_ID`, `PLAID_SECRET`, `PLAID_ENV=sandbox` in `.env`.
3. Set `MOCK_DATA=false`.
4. For OAuth institutions and webhooks, tunnel your local server (ngrok/cloudflared) and set `PLAID_REDIRECT_URI` / `PLAID_WEBHOOK_URL` to the tunnel URL, and register the redirect URI in the Plaid dashboard.
5. Sandbox login: `user_good` / `pass_good` (MFA: `mfa_device`).

### Testing webhooks + automation (M3) against Sandbox

With `npm run dev` and a tunnel running:

- **End-to-end sync**: connect an item, then call `POST /sandbox/item/fire_webhook` (Plaid API, `webhook_code: "SYNC_UPDATES_AVAILABLE"`, the item's `access_token`) — the app's `/api/plaid/webhook` should verify it, insert a `webhook_events` row, and sync it inline within that same request. Check `sync_runs` and the Accounts freshness badge.
- **Cron routes locally**: `curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/sync-all` (and `/api/cron/nightly`) — set `CRON_SECRET` in `.env` first; these 401 without it, same as production.
- **Tampered webhook rejected**: POST anything to `/api/plaid/webhook` without a valid `Plaid-Verification` header, or with the body altered after signing — expect `400`.
- **Re-auth flow**: call `POST /sandbox/item/reset_login` for a Sandbox item, then either wait for the `ITEM_LOGIN_REQUIRED` webhook or trigger a sync manually — the item flips to `login_required`, the Accounts screen shows the "Login expired" banner, and its **Reconnect** button opens Link in update mode. Completing Link with `user_good`/`pass_good` should clear the banner.

### Testing categorization, rules, and budgets (M4)

- **Default categorization**: sync a mock or Sandbox account, open **Transactions** — every row should already show a category derived from Plaid's PFC (not "Uncategorized"), since `lib/categorize.ts` runs after every sync.
- **Manual override sticks**: click a transaction's category, pick a different one — re-syncing (or a future webhook sync) must never revert it, since `category_source` flips to `manual` and both `mapPlaidTransaction.ts` and `categorize.ts` skip manual rows unconditionally.
- **Rule + preview**: on `/rules`, build a match (e.g. merchant contains "Amazon"), click **Preview** to see the affected count, then create it with "Apply to existing transactions" checked — the exact previewed count should get recategorized (§7.2's core acceptance bullet).
- **Card payment excluded from spend on both sides**: after a sync that includes a credit card payment and its funding-account debit, both legs should show `is_transfer = true` (check via `db:studio`) and neither should appear in that month's `/budgets` spend for any category.
- **Budget math**: set a budget for a category, hand-total that category's transactions for the month, and compare to the **Budgets** page's "spent" and "left" figures.

### Testing investments + liabilities (M5)

- **Brokerage value matches**: connect a Sandbox brokerage (or mock — "Meridian Investments" ships two accounts with holdings out of the box), open `/investments`, and compare the portfolio value / per-holding values against what the institution actually reports.
- **Allocation sums to 100%**: on `/investments`, the allocation bar's slices (plus their percentages) should sum to 100%, with cash equivalents grouped into their own "Cash" slice regardless of the security's nominal type.
- **Null-limit card excluded and footnoted**: for a card with no reported credit limit, `/cards` should show "Unknown (no limit reported)" for that card and the overall utilization card should foot-note it as excluded — check `computeUtilization` in `lib/portfolioMath.test.ts` for the unit-level version of this same case.
- **Graceful degradation**: an item with only a checking/savings account (no investment or credit accounts) should sync without errors — `sync_runs` should show `holdings`/`inv_tx`/`liabilities` rows with no error (Plaid's "not supported" response is treated as a no-op, not a failure).

### Testing the dashboard (M6)

- **Drill-downs are exact**: click any Overview stat tile, the "where it went" bars, or a budget row — the Transactions list you land on should contain exactly the rows that produced that number, not a superset. Spend/income/cash-flow links carry `transfer=0&excluded=0&kind=...` precisely so a transfer or excluded transaction in range can't inflate what you see versus what was summed.
- **Numbers match the transactions page**: hand-total the transactions on a drill-down page and compare to the stat tile / bar / budget-row figure that linked there.
- **Dark mode**: toggle the theme (top bar) and check the Overview charts — every color is a `var(--...)` reference to the same tokens the rest of the app uses, so there's nothing chart-specific to break.
- **No dual-axis chart**: there are exactly two chart components (`components/charts/NetWorthChart.tsx`, `CashFlowChart.tsx`), each with a single Y-axis.
- **Recurring detection**: mock mode ships Netflix and Spotify as 3-month-old monthly charges specifically so `/subscriptions` has something to show out of the box; on Sandbox, recurring detection needs ≥3 real occurrences of the same merchant/account/amount before it appears.

## Backups

This app is your entire financial history — back up Postgres like you mean it.

```bash
# Backup (run anywhere with network access to the DB)
pg_dump "$DATABASE_URL" -Fc -f tally-$(date +%Y%m%d).dump

# Restore into a fresh database
pg_restore -d "$DATABASE_URL" --clean --if-exists tally-20260101.dump
```

For Docker Compose, run `pg_dump`/`pg_restore` from a container with network access to the `postgres` service (`docker compose exec postgres pg_dump -U tally tally -Fc -f /tmp/backup.dump`, then copy it out with `docker cp`). Encrypt backups at rest (they contain everything `raw` JSONB has ever seen) and schedule them — a cron job calling the `pg_dump` line above, piped to your storage of choice, is enough at this scale. `/api/export` (Settings → Export) is a lighter-weight, human-readable alternative for just the transaction data, not a substitute for a real `pg_dump` backup.

## Secret rotation

- **`PLAID_SECRET`**: generate a new secret in the [Plaid dashboard](https://dashboard.plaid.com), set it in `.env`, restart the app, confirm a sync still works, then revoke the old secret in the dashboard. No data migration needed — it's only ever sent to Plaid, never stored.
- **`MASTER_KEY`**: this one *is* stored — it's what every `plaid_items.access_token_ciphertext` is encrypted under, so rotating it means re-encrypting every row, not just swapping an env var.
  1. Pause the app (no syncs in flight during rotation) — e.g. temporarily disable the Vercel Cron Jobs, or run this during a quiet window.
  2. Generate a new key: `openssl rand -base64 32`.
  3. Run the rotation script with both keys in the environment:
     ```bash
     OLD_MASTER_KEY=<current MASTER_KEY> NEW_MASTER_KEY=<new key> npm run rotate:master-key
     ```
  4. Set `MASTER_KEY` to the new key in `.env` (and in Vercel for production), restart/redeploy, and confirm a manual sync works.
  5. Keep the old key somewhere safe until you've confirmed the app works — the script's own log tells you if it stopped partway through, which is the one case where you'd need it.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start the app |
| `npm run build` / `npm run start` | Production build / run |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run db:generate` | Generate a Drizzle migration from `db/schema.ts` |
| `npm run db:migrate` | Apply migrations |
| `npm run db:studio` | Drizzle Studio (browse the DB) |
| `npm run seed:user` | Create/update the single admin user from `ADMIN_EMAIL`/`ADMIN_PASSWORD` |
| `npm run seed:categories` | Seed system categories from Plaid's PFC taxonomy (idempotent) |
| `npm run rotate:master-key` | Re-encrypts every stored access token under a new `MASTER_KEY` — see **Secret rotation** |

## Security notes

- Plaid access tokens are AES-256-GCM encrypted at rest (`lib/crypto.ts`) and decrypted only inside `lib/plaid.ts`, server-side. They are never selected into an API response and never reach a client component.
- The webhook endpoint verifies Plaid's JWT signature (`lib/plaidWebhook.ts`) — body hash, `kid`→key lookup, `iat` freshness — before persisting or acting on anything.
- `middleware.ts` uses an edge-safe NextAuth config (`lib/auth.config.ts`) with no DB/bcrypt in it, so the Node-only credentials logic (`lib/auth.ts`) never gets bundled into the Edge runtime.

## License

[Functional Source License 1.1, Apache 2.0 Future Grant](LICENSE) (FSL-1.1-ALv2). Free to self-host, modify, and use for anything other than offering it (or a substantially similar service) to others commercially. Each release converts to Apache 2.0 automatically two years after it's published.
