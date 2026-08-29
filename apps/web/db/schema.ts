import {
  pgTable,
  uuid,
  text,
  bigint,
  boolean,
  timestamp,
  date,
  jsonb,
  numeric,
  integer,
  uniqueIndex,
  index,
  pgEnum,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export const itemStatusEnum = pgEnum("item_status", [
  "healthy",
  "login_required",
  "pending_expiration",
  "revoked",
  "error",
]);

export const categorySourceEnum = pgEnum("category_source", [
  "plaid",
  "ml",
  "rule",
  "manual",
]);

export const categoryKindEnum = pgEnum("category_kind", [
  "income",
  "expense",
  "transfer",
  "ignore",
]);

export const recurringStatusEnum = pgEnum("recurring_status", [
  "active",
  "at_risk",
  "cancelled",
]);

export const recurringFrequencyEnum = pgEnum("recurring_frequency", [
  "weekly",
  "biweekly",
  "monthly",
  "quarterly",
  "annual",
]);

export const syncKindEnum = pgEnum("sync_kind", [
  "transactions",
  "holdings",
  "inv_tx",
  "liabilities",
  "balances",
]);

export const syncTriggerEnum = pgEnum("sync_trigger", [
  "webhook",
  "cron",
  "manual",
  "initial",
]);

// ---------------------------------------------------------------------------
// Core
// ---------------------------------------------------------------------------

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: text("name"),
  // Optional — only entered if the user wants the FIRE calculator to show
  // the age (not just years away) they'll hit their FIRE number.
  birthDate: date("birth_date"),
  timezone: text("timezone").notNull().default("America/New_York"),
  baseCurrency: text("base_currency").notNull().default("USD"),
  recapsEnabled: boolean("recaps_enabled").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Refresh tokens for the mobile app's bearer-token auth path, parallel to
// (and independent of) NextAuth's own cookie session. Only a hash of the
// token is stored, same treatment as users.passwordHash — a stolen row is
// useless without the raw value, and a device is revoked by deleting its row.
export const mobileRefreshTokens = pgTable("mobile_refresh_tokens", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  deviceInfo: text("device_info"),
});

export const plaidItems = pgTable("plaid_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  plaidItemId: text("plaid_item_id").notNull().unique(),
  institutionId: text("institution_id"),
  institutionName: text("institution_name"),
  // Envelope-encrypted access token — see lib/crypto.ts. Never selected into
  // any API response; decrypted only inside lib/plaid.ts.
  accessTokenCiphertext: text("access_token_ciphertext").notNull(),
  accessTokenIv: text("access_token_iv").notNull(),
  accessTokenTag: text("access_token_tag").notNull(),
  status: itemStatusEnum("status").notNull().default("healthy"),
  lastErrorCode: text("last_error_code"),
  consentedProducts: jsonb("consented_products").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
  availableProducts: jsonb("available_products").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
  transactionsCursor: text("transactions_cursor"),
  // Plaid's transactions_update_status verbatim ("NOT_READY" |
  // "INITIAL_UPDATE_COMPLETE" | "HISTORICAL_UPDATE_COMPLETE"), refreshed on
  // every transactions sync — lets the UI tell "just synced, nothing new"
  // apart from "hasn't finished its first pull yet," which lastSyncedAt
  // alone can't distinguish (a NOT_READY sync still completes "successfully"
  // with zero rows).
  transactionsUpdateStatus: text("transactions_update_status"),
  lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  userIdx: index("plaid_items_user_idx").on(t.userId),
}));

export const institutions = pgTable("institutions", {
  id: text("id").primaryKey(), // Plaid institution_id
  name: text("name").notNull(),
  logoBase64: text("logo_base64"),
  primaryColor: text("primary_color"),
  url: text("url"),
  oauth: boolean("oauth").notNull().default(false),
  // What this institution actually supports (Plaid's institutions/get_by_id
  // `products` field) — distinct from an item's consentedProducts, which
  // reflects what the user was asked to consent to, not what the
  // institution can actually fulfill. Plaid still grants consent for a
  // product an institution then rejects at call time with
  // PRODUCTS_NOT_SUPPORTED, so this is the field sync gating should use.
  products: jsonb("products").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
});

export const accounts = pgTable("accounts", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  itemId: uuid("item_id").references(() => plaidItems.id, { onDelete: "cascade" }),
  plaidAccountId: text("plaid_account_id").unique(),
  name: text("name").notNull(),
  // User-set display name, shown in place of `name` everywhere an account
  // is rendered -- see @tally/core/accountName. Null means "use the real
  // Plaid name," not "no nickname was ever considered."
  nickname: text("nickname"),
  officialName: text("official_name"),
  mask: text("mask"),
  type: text("type").notNull(), // depository | credit | investment | loan
  subtype: text("subtype"),
  currency: text("currency").notNull().default("USD"),
  isHidden: boolean("is_hidden").notNull().default(false),
  isManual: boolean("is_manual").notNull().default(false),
  currentBalance: bigint("current_balance", { mode: "number" }),
  availableBalance: bigint("available_balance", { mode: "number" }),
  creditLimit: bigint("credit_limit", { mode: "number" }),
  // True once the user has entered a limit by hand (Plaid didn't report
  // one). Balance-refresh syncs must not null this back out just because
  // Plaid still has nothing — see lib/plaidBalances.ts.
  creditLimitIsManual: boolean("credit_limit_is_manual").notNull().default(false),
  balanceAsOf: timestamp("balance_as_of", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  userIdx: index("accounts_user_idx").on(t.userId),
  itemIdx: index("accounts_item_idx").on(t.itemId),
}));

export const accountBalances = pgTable("account_balances", {
  id: uuid("id").primaryKey().defaultRandom(),
  accountId: uuid("account_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
  asOfDate: date("as_of_date").notNull(),
  current: bigint("current", { mode: "number" }),
  available: bigint("available", { mode: "number" }),
  limit: bigint("limit", { mode: "number" }),
}, (t) => ({
  acctDateIdx: uniqueIndex("account_balances_acct_date_idx").on(t.accountId, t.asOfDate),
}));

// ---------------------------------------------------------------------------
// Categories & rules
// ---------------------------------------------------------------------------

export const categories = pgTable("categories", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }), // null = system category
  parentId: uuid("parent_id"),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  icon: text("icon"),
  colorSlot: integer("color_slot").notNull().default(1), // 1-8, maps to --series-N
  kind: categoryKindEnum("kind").notNull().default("expense"),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const rules = pgTable("rules", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  priority: integer("priority").notNull().default(0),
  enabled: boolean("enabled").notNull().default(true),
  match: jsonb("match").notNull(),
  actions: jsonb("actions").notNull(),
  appliesToExisting: boolean("applies_to_existing").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  userIdx: index("rules_user_idx").on(t.userId),
}));

// ---------------------------------------------------------------------------
// Manual income schedules
// ---------------------------------------------------------------------------

// A user-defined recurring paycheck the sync engines can't see (e.g. a bank
// whose Plaid transactions feed doesn't reliably return the deposit). Each
// anchor in dayAnchors is a day-of-month (1-31) or 0 for "last day of the
// month"; lib/incomeSchedule.ts resolves an anchor to an actual date for a
// given month and shifts a weekend landing back to the preceding Friday.
// Balances/net worth are unaffected either way (those come from Plaid's
// balance endpoint, not from summing transactions) — this only exists so
// income shows up in the transactions list, cash flow, and budgets.
export const incomeSchedules = pgTable("income_schedules", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  accountId: uuid("account_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
  categoryId: uuid("category_id").references(() => categories.id),
  label: text("label").notNull().default("Paycheck"),
  amount: bigint("amount", { mode: "number" }).notNull(), // cents, positive
  dayAnchors: jsonb("day_anchors").$type<number[]>().notNull().default(sql`'[15,0]'::jsonb`),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  userIdx: index("income_schedules_user_idx").on(t.userId),
}));

// ---------------------------------------------------------------------------
// Transactions
// ---------------------------------------------------------------------------

export const transactions = pgTable("transactions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  accountId: uuid("account_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
  plaidTransactionId: text("plaid_transaction_id").unique(),
  pendingTransactionId: text("pending_transaction_id"),
  isPending: boolean("is_pending").notNull().default(false),
  amount: bigint("amount", { mode: "number" }).notNull(), // cents; expenses negative, income positive
  currency: text("currency").notNull().default("USD"),
  postedDate: date("posted_date").notNull(),
  authorizedDate: date("authorized_date"),
  name: text("name").notNull(),
  merchantName: text("merchant_name"),
  merchantEntityId: text("merchant_entity_id"),
  logoUrl: text("logo_url"),
  website: text("website"),
  paymentChannel: text("payment_channel"),
  pfcPrimary: text("pfc_primary"),
  pfcDetailed: text("pfc_detailed"),
  pfcConfidence: text("pfc_confidence"),
  categoryId: uuid("category_id").references(() => categories.id),
  categorySource: categorySourceEnum("category_source").notNull().default("plaid"),
  counterparties: jsonb("counterparties"),
  location: jsonb("location"),
  notes: text("notes"),
  tags: jsonb("tags").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
  isTransfer: boolean("is_transfer").notNull().default(false),
  transferGroupId: uuid("transfer_group_id"),
  excludedFromBudget: boolean("excluded_from_budget").notNull().default(false),
  reviewed: boolean("reviewed").notNull().default(false),
  // True for a row that didn't come from Plaid (currently: paychecks generated
  // from an income schedule). Never touched by sync — sync only ever matches
  // rows by plaidTransactionId, which these don't have — and it's what gates
  // the "Delete" action in the transaction detail panel, since a Plaid-synced
  // row would just come back on the next sync.
  isManual: boolean("is_manual").notNull().default(false),
  incomeScheduleId: uuid("income_schedule_id").references(() => incomeSchedules.id, { onDelete: "set null" }),
  // Set only for a row lib/recurringBillGeneration.ts fabricated from a
  // manually-added bill (recurringStreams.isManual) — no .references() here
  // since recurringStreams is declared further down this file; matches how
  // categories.parentId/transferGroupId skip an explicit FK for the same
  // forward-reference reason.
  recurringStreamId: uuid("recurring_stream_id"),
  raw: jsonb("raw"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  userDateIdx: index("transactions_user_date_idx").on(t.userId, t.postedDate),
  acctDateIdx: index("transactions_acct_date_idx").on(t.accountId, t.postedDate),
  pendingIdx: index("transactions_pending_idx").on(t.userId).where(sql`is_pending`),
  incomeScheduleIdx: index("transactions_income_schedule_idx").on(t.incomeScheduleId),
  recurringStreamIdx: index("transactions_recurring_stream_idx").on(t.recurringStreamId),
}));

export const transactionSplits = pgTable("transaction_splits", {
  id: uuid("id").primaryKey().defaultRandom(),
  transactionId: uuid("transaction_id").notNull().references(() => transactions.id, { onDelete: "cascade" }),
  categoryId: uuid("category_id").references(() => categories.id),
  amount: bigint("amount", { mode: "number" }).notNull(),
  note: text("note"),
});

// ---------------------------------------------------------------------------
// Budgets
// ---------------------------------------------------------------------------

export const budgets = pgTable("budgets", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  month: date("month").notNull(), // always the 1st
  categoryId: uuid("category_id").notNull().references(() => categories.id),
  amount: bigint("amount", { mode: "number" }).notNull(),
  rolloverEnabled: boolean("rollover_enabled").notNull().default(false),
  rolloverFromPrior: bigint("rollover_from_prior", { mode: "number" }).notNull().default(0),
  // A fixed monthly charge (rent, insurance) that posts once and doesn't
  // accrue through the month — computeBurnRateProjection's linear
  // spend-so-far/days-elapsed extrapolation is meaningless for it (posting
  // the full amount on day 1 makes it look like it's on pace to blow way
  // past the budget by month end, when in fact it's simply already done).
  // Suppresses the projection marker/line for this budget in
  // BudgetRow.tsx/BudgetMeterList.tsx.
  isFixedAmount: boolean("is_fixed_amount").notNull().default(false),
}, (t) => ({
  userMonthIdx: index("budgets_user_month_idx").on(t.userId, t.month),
  uniq: uniqueIndex("budgets_user_month_category_idx").on(t.userId, t.month, t.categoryId),
}));

// ---------------------------------------------------------------------------
// Investments
// ---------------------------------------------------------------------------

export const securities = pgTable("securities", {
  id: uuid("id").primaryKey().defaultRandom(),
  plaidSecurityId: text("plaid_security_id").unique(),
  ticker: text("ticker"),
  cusip: text("cusip"),
  isin: text("isin"),
  name: text("name"),
  type: text("type"),
  isCashEquivalent: boolean("is_cash_equivalent").notNull().default(false),
  closePrice: bigint("close_price", { mode: "number" }), // cents
  closePriceAsOf: date("close_price_as_of"),
  currency: text("currency").notNull().default("USD"),
  sector: text("sector"),
  assetClass: text("asset_class"),
});

export const holdings = pgTable("holdings", {
  id: uuid("id").primaryKey().defaultRandom(),
  accountId: uuid("account_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
  securityId: uuid("security_id").notNull().references(() => securities.id),
  quantity: numeric("quantity", { precision: 28, scale: 10 }).notNull(),
  costBasis: bigint("cost_basis", { mode: "number" }),
  institutionPrice: bigint("institution_price", { mode: "number" }),
  institutionPriceAsOf: date("institution_price_as_of"),
  institutionValue: bigint("institution_value", { mode: "number" }).notNull(),
  // The Holding's own iso_currency_code/unofficial_currency_code — what
  // institutionPrice/institutionValue are actually denominated in. Distinct
  // from securities.currency (the security's general trading currency);
  // this app does no FX conversion, so every display of these numbers must
  // show this alongside them rather than imply everything's one currency.
  currency: text("currency").notNull().default("USD"),
  asOfDate: date("as_of_date").notNull(),
}, (t) => ({
  uniq: uniqueIndex("holdings_acct_sec_date_idx").on(t.accountId, t.securityId, t.asOfDate),
  acctDateIdx: index("holdings_acct_date_idx").on(t.accountId, t.asOfDate),
}));

export const investmentTransactions = pgTable("investment_transactions", {
  id: uuid("id").primaryKey().defaultRandom(),
  accountId: uuid("account_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
  plaidInvestmentTransactionId: text("plaid_investment_transaction_id").unique(),
  securityId: uuid("security_id").references(() => securities.id),
  date: date("date").notNull(),
  name: text("name"),
  quantity: numeric("quantity", { precision: 28, scale: 10 }),
  amount: bigint("amount", { mode: "number" }).notNull(),
  price: bigint("price", { mode: "number" }),
  fees: bigint("fees", { mode: "number" }),
  type: text("type"),
  subtype: text("subtype"),
  currency: text("currency").notNull().default("USD"),
});

// ---------------------------------------------------------------------------
// Liabilities
// ---------------------------------------------------------------------------

export const liabilitiesCredit = pgTable("liabilities_credit", {
  id: uuid("id").primaryKey().defaultRandom(),
  accountId: uuid("account_id").notNull().references(() => accounts.id, { onDelete: "cascade" }).unique(),
  aprs: jsonb("aprs"),
  isOverdue: boolean("is_overdue").notNull().default(false),
  lastPaymentAmount: bigint("last_payment_amount", { mode: "number" }),
  lastPaymentDate: date("last_payment_date"),
  lastStatementBalance: bigint("last_statement_balance", { mode: "number" }),
  lastStatementIssueDate: date("last_statement_issue_date"),
  minimumPaymentAmount: bigint("minimum_payment_amount", { mode: "number" }),
  nextPaymentDueDate: date("next_payment_due_date"),
  asOf: timestamp("as_of", { withTimezone: true }),
});

// ---------------------------------------------------------------------------
// Recurring / subscriptions
// ---------------------------------------------------------------------------

export const recurringStreams = pgTable("recurring_streams", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  merchantKey: text("merchant_key").notNull(),
  description: text("description"),
  accountId: uuid("account_id").references(() => accounts.id),
  categoryId: uuid("category_id").references(() => categories.id),
  averageAmount: bigint("average_amount", { mode: "number" }).notNull(),
  frequency: recurringFrequencyEnum("frequency").notNull(),
  lastDate: date("last_date"),
  predictedNextDate: date("predicted_next_date"),
  // User override for predictedNextDate — for a bill that's paid in irregular
  // lump sums (e.g. rent prepaid several months at once), the gap-based
  // detection in lib/recurringDetection.ts can't guess the real next date (or
  // even keeps the stream classified, since detectRecurringForUser's upsert
  // only ever `set`s the columns it recomputes, never this one). Sticks until
  // the user clears or changes it themselves — nothing here auto-invalidates it.
  manualNextDueDate: date("manual_next_due_date"),
  status: recurringStatusEnum("status").notNull().default("active"),
  confidence: numeric("confidence", { precision: 4, scale: 3 }),
  transactionIds: jsonb("transaction_ids").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
  // True only for a row created directly via Subscriptions' "+ Add a bill"
  // (never set by detectRecurringForUser's upsert, same guard as
  // manualNextDueDate above) — gates lib/recurringBillGeneration.ts, which
  // only fabricates a monthly transaction for these. An auto-detected stream
  // already gets real Plaid transactions on its own; synthesizing one
  // alongside would double-count it.
  isManual: boolean("is_manual").notNull().default(false),
}, (t) => ({
  userIdx: index("recurring_user_idx").on(t.userId),
  uniq: uniqueIndex("recurring_user_merchant_account_idx").on(t.userId, t.merchantKey, t.accountId),
}));

// ---------------------------------------------------------------------------
// Net worth / sync bookkeeping
// ---------------------------------------------------------------------------

export const netWorthSnapshots = pgTable("net_worth_snapshots", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  asOfDate: date("as_of_date").notNull(),
  assets: bigint("assets", { mode: "number" }).notNull(),
  liabilities: bigint("liabilities", { mode: "number" }).notNull(),
  net: bigint("net", { mode: "number" }).notNull(),
  breakdown: jsonb("breakdown"),
}, (t) => ({
  uniq: uniqueIndex("net_worth_user_date_idx").on(t.userId, t.asOfDate),
}));

export const fireSettings = pgTable("fire_settings", {
  userId: uuid("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  swr: numeric("swr", { precision: 5, scale: 4 }).notNull(), // e.g. 0.0400
  expectedReturn: numeric("expected_return", { precision: 5, scale: 4 }).notNull(),
  annualExpensesOverride: bigint("annual_expenses_override", { mode: "number" }),
  monthlyContributionOverride: bigint("monthly_contribution_override", { mode: "number" }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// One row per user per month a recap email was (or will be) sent for.
// Doubles as the cron's idempotency check (skip a user once `sentAt` is set)
// and as the only history of past FIRE projections — next month's job reads
// this row's `yearsToFire` to report "N years sooner than last month" (there
// is otherwise no stored history of fireSettings/projections over time).
export const monthlyRecaps = pgTable("monthly_recaps", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  month: date("month").notNull(),
  yearsToFire: numeric("years_to_fire", { precision: 6, scale: 2 }),
  sentAt: timestamp("sent_at", { withTimezone: true }),
}, (t) => ({
  uniq: uniqueIndex("monthly_recaps_user_month_idx").on(t.userId, t.month),
}));

export const webhookEvents = pgTable("webhook_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  provider: text("provider").notNull().default("plaid"),
  itemId: text("item_id"),
  webhookType: text("webhook_type").notNull(),
  webhookCode: text("webhook_code").notNull(),
  payload: jsonb("payload").notNull(),
  signatureVerified: boolean("signature_verified").notNull(),
  receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
  processedAt: timestamp("processed_at", { withTimezone: true }),
  status: text("status").notNull().default("pending"), // pending | processed | failed
  attempts: integer("attempts").notNull().default(0),
  error: text("error"),
});

export const syncRuns = pgTable("sync_runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  itemId: uuid("item_id").notNull().references(() => plaidItems.id, { onDelete: "cascade" }),
  kind: syncKindEnum("kind").notNull(),
  trigger: syncTriggerEnum("trigger").notNull(),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
  added: integer("added").notNull().default(0),
  modified: integer("modified").notNull().default(0),
  removed: integer("removed").notNull().default(0),
  error: text("error"),
}, (t) => ({
  itemIdx: index("sync_runs_item_idx").on(t.itemId),
}));

export const auditLog = pgTable("audit_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id),
  action: text("action").notNull(),
  entity: text("entity").notNull(),
  entityId: text("entity_id"),
  before: jsonb("before"),
  after: jsonb("after"),
  at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// Relations
// ---------------------------------------------------------------------------

export const usersRelations = relations(users, ({ many }) => ({
  items: many(plaidItems),
  accounts: many(accounts),
  mobileRefreshTokens: many(mobileRefreshTokens),
}));

export const mobileRefreshTokensRelations = relations(mobileRefreshTokens, ({ one }) => ({
  user: one(users, { fields: [mobileRefreshTokens.userId], references: [users.id] }),
}));

export const plaidItemsRelations = relations(plaidItems, ({ one, many }) => ({
  user: one(users, { fields: [plaidItems.userId], references: [users.id] }),
  accounts: many(accounts),
  syncRuns: many(syncRuns),
}));

export const accountsRelations = relations(accounts, ({ one, many }) => ({
  item: one(plaidItems, { fields: [accounts.itemId], references: [plaidItems.id] }),
  user: one(users, { fields: [accounts.userId], references: [users.id] }),
  transactions: many(transactions),
  liability: one(liabilitiesCredit, { fields: [accounts.id], references: [liabilitiesCredit.accountId] }),
}));

export const transactionsRelations = relations(transactions, ({ one, many }) => ({
  account: one(accounts, { fields: [transactions.accountId], references: [accounts.id] }),
  category: one(categories, { fields: [transactions.categoryId], references: [categories.id] }),
  splits: many(transactionSplits),
}));
