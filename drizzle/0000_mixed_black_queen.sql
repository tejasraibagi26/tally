CREATE TYPE "public"."category_kind" AS ENUM('income', 'expense', 'transfer', 'ignore');--> statement-breakpoint
CREATE TYPE "public"."category_source" AS ENUM('plaid', 'ml', 'rule', 'manual');--> statement-breakpoint
CREATE TYPE "public"."item_status" AS ENUM('healthy', 'login_required', 'pending_expiration', 'revoked', 'error');--> statement-breakpoint
CREATE TYPE "public"."recurring_frequency" AS ENUM('weekly', 'biweekly', 'monthly', 'quarterly', 'annual');--> statement-breakpoint
CREATE TYPE "public"."recurring_status" AS ENUM('active', 'at_risk', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."sync_kind" AS ENUM('transactions', 'holdings', 'inv_tx', 'liabilities', 'balances');--> statement-breakpoint
CREATE TYPE "public"."sync_trigger" AS ENUM('webhook', 'cron', 'manual', 'initial');--> statement-breakpoint
CREATE TABLE "account_balances" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"as_of_date" date NOT NULL,
	"current" bigint,
	"available" bigint,
	"limit" bigint
);
--> statement-breakpoint
CREATE TABLE "accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"item_id" uuid,
	"plaid_account_id" text,
	"name" text NOT NULL,
	"official_name" text,
	"mask" text,
	"type" text NOT NULL,
	"subtype" text,
	"currency" text DEFAULT 'USD' NOT NULL,
	"is_hidden" boolean DEFAULT false NOT NULL,
	"is_manual" boolean DEFAULT false NOT NULL,
	"current_balance" bigint,
	"available_balance" bigint,
	"credit_limit" bigint,
	"balance_as_of" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "accounts_plaid_account_id_unique" UNIQUE("plaid_account_id")
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"action" text NOT NULL,
	"entity" text NOT NULL,
	"entity_id" text,
	"before" jsonb,
	"after" jsonb,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "budgets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"month" date NOT NULL,
	"category_id" uuid NOT NULL,
	"amount" bigint NOT NULL,
	"rollover_enabled" boolean DEFAULT false NOT NULL,
	"rollover_from_prior" bigint DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"parent_id" uuid,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"icon" text,
	"color_slot" integer DEFAULT 1 NOT NULL,
	"kind" "category_kind" DEFAULT 'expense' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "holdings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"security_id" uuid NOT NULL,
	"quantity" numeric(28, 10) NOT NULL,
	"cost_basis" bigint,
	"institution_price" bigint,
	"institution_price_as_of" date,
	"institution_value" bigint NOT NULL,
	"as_of_date" date NOT NULL
);
--> statement-breakpoint
CREATE TABLE "institutions" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"logo_base64" text,
	"primary_color" text,
	"url" text,
	"oauth" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "investment_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"plaid_investment_transaction_id" text,
	"security_id" uuid,
	"date" date NOT NULL,
	"name" text,
	"quantity" numeric(28, 10),
	"amount" bigint NOT NULL,
	"price" bigint,
	"fees" bigint,
	"type" text,
	"subtype" text,
	"currency" text DEFAULT 'USD' NOT NULL,
	CONSTRAINT "investment_transactions_plaid_investment_transaction_id_unique" UNIQUE("plaid_investment_transaction_id")
);
--> statement-breakpoint
CREATE TABLE "liabilities_credit" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"aprs" jsonb,
	"is_overdue" boolean DEFAULT false NOT NULL,
	"last_payment_amount" bigint,
	"last_payment_date" date,
	"last_statement_balance" bigint,
	"last_statement_issue_date" date,
	"minimum_payment_amount" bigint,
	"next_payment_due_date" date,
	"as_of" timestamp with time zone,
	CONSTRAINT "liabilities_credit_account_id_unique" UNIQUE("account_id")
);
--> statement-breakpoint
CREATE TABLE "net_worth_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"as_of_date" date NOT NULL,
	"assets" bigint NOT NULL,
	"liabilities" bigint NOT NULL,
	"net" bigint NOT NULL,
	"breakdown" jsonb
);
--> statement-breakpoint
CREATE TABLE "plaid_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"plaid_item_id" text NOT NULL,
	"institution_id" text,
	"institution_name" text,
	"access_token_ciphertext" text NOT NULL,
	"access_token_iv" text NOT NULL,
	"access_token_tag" text NOT NULL,
	"status" "item_status" DEFAULT 'healthy' NOT NULL,
	"last_error_code" text,
	"consented_products" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"available_products" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"transactions_cursor" text,
	"last_synced_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "plaid_items_plaid_item_id_unique" UNIQUE("plaid_item_id")
);
--> statement-breakpoint
CREATE TABLE "recurring_streams" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"merchant_key" text NOT NULL,
	"description" text,
	"account_id" uuid,
	"category_id" uuid,
	"average_amount" bigint NOT NULL,
	"frequency" "recurring_frequency" NOT NULL,
	"last_date" date,
	"predicted_next_date" date,
	"status" "recurring_status" DEFAULT 'active' NOT NULL,
	"confidence" numeric(4, 3),
	"transaction_ids" jsonb DEFAULT '[]'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"priority" integer DEFAULT 0 NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"match" jsonb NOT NULL,
	"actions" jsonb NOT NULL,
	"applies_to_existing" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "securities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plaid_security_id" text,
	"ticker" text,
	"cusip" text,
	"isin" text,
	"name" text,
	"type" text,
	"is_cash_equivalent" boolean DEFAULT false NOT NULL,
	"close_price" bigint,
	"close_price_as_of" date,
	"currency" text DEFAULT 'USD' NOT NULL,
	"sector" text,
	"asset_class" text,
	CONSTRAINT "securities_plaid_security_id_unique" UNIQUE("plaid_security_id")
);
--> statement-breakpoint
CREATE TABLE "sync_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"item_id" uuid NOT NULL,
	"kind" "sync_kind" NOT NULL,
	"trigger" "sync_trigger" NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"added" integer DEFAULT 0 NOT NULL,
	"modified" integer DEFAULT 0 NOT NULL,
	"removed" integer DEFAULT 0 NOT NULL,
	"error" text
);
--> statement-breakpoint
CREATE TABLE "transaction_splits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"transaction_id" uuid NOT NULL,
	"category_id" uuid,
	"amount" bigint NOT NULL,
	"note" text
);
--> statement-breakpoint
CREATE TABLE "transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	"plaid_transaction_id" text,
	"pending_transaction_id" text,
	"is_pending" boolean DEFAULT false NOT NULL,
	"amount" bigint NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"posted_date" date NOT NULL,
	"authorized_date" date,
	"name" text NOT NULL,
	"merchant_name" text,
	"merchant_entity_id" text,
	"logo_url" text,
	"website" text,
	"payment_channel" text,
	"pfc_primary" text,
	"pfc_detailed" text,
	"pfc_confidence" text,
	"category_id" uuid,
	"category_source" "category_source" DEFAULT 'plaid' NOT NULL,
	"counterparties" jsonb,
	"location" jsonb,
	"notes" text,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"is_transfer" boolean DEFAULT false NOT NULL,
	"transfer_group_id" uuid,
	"excluded_from_budget" boolean DEFAULT false NOT NULL,
	"raw" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "transactions_plaid_transaction_id_unique" UNIQUE("plaid_transaction_id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"name" text,
	"timezone" text DEFAULT 'America/New_York' NOT NULL,
	"base_currency" text DEFAULT 'USD' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "webhook_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" text DEFAULT 'plaid' NOT NULL,
	"item_id" text,
	"webhook_type" text NOT NULL,
	"webhook_code" text NOT NULL,
	"payload" jsonb NOT NULL,
	"signature_verified" boolean NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone,
	"status" text DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"error" text
);
--> statement-breakpoint
ALTER TABLE "account_balances" ADD CONSTRAINT "account_balances_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_item_id_plaid_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."plaid_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "holdings" ADD CONSTRAINT "holdings_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "holdings" ADD CONSTRAINT "holdings_security_id_securities_id_fk" FOREIGN KEY ("security_id") REFERENCES "public"."securities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "investment_transactions" ADD CONSTRAINT "investment_transactions_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "investment_transactions" ADD CONSTRAINT "investment_transactions_security_id_securities_id_fk" FOREIGN KEY ("security_id") REFERENCES "public"."securities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "liabilities_credit" ADD CONSTRAINT "liabilities_credit_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "net_worth_snapshots" ADD CONSTRAINT "net_worth_snapshots_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plaid_items" ADD CONSTRAINT "plaid_items_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_streams" ADD CONSTRAINT "recurring_streams_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_streams" ADD CONSTRAINT "recurring_streams_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_streams" ADD CONSTRAINT "recurring_streams_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rules" ADD CONSTRAINT "rules_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sync_runs" ADD CONSTRAINT "sync_runs_item_id_plaid_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."plaid_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transaction_splits" ADD CONSTRAINT "transaction_splits_transaction_id_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transaction_splits" ADD CONSTRAINT "transaction_splits_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "account_balances_acct_date_idx" ON "account_balances" USING btree ("account_id","as_of_date");--> statement-breakpoint
CREATE INDEX "accounts_user_idx" ON "accounts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "accounts_item_idx" ON "accounts" USING btree ("item_id");--> statement-breakpoint
CREATE INDEX "budgets_user_month_idx" ON "budgets" USING btree ("user_id","month");--> statement-breakpoint
CREATE UNIQUE INDEX "budgets_user_month_category_idx" ON "budgets" USING btree ("user_id","month","category_id");--> statement-breakpoint
CREATE UNIQUE INDEX "holdings_acct_sec_date_idx" ON "holdings" USING btree ("account_id","security_id","as_of_date");--> statement-breakpoint
CREATE INDEX "holdings_acct_date_idx" ON "holdings" USING btree ("account_id","as_of_date");--> statement-breakpoint
CREATE UNIQUE INDEX "net_worth_user_date_idx" ON "net_worth_snapshots" USING btree ("user_id","as_of_date");--> statement-breakpoint
CREATE INDEX "plaid_items_user_idx" ON "plaid_items" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "recurring_user_idx" ON "recurring_streams" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "rules_user_idx" ON "rules" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sync_runs_item_idx" ON "sync_runs" USING btree ("item_id");--> statement-breakpoint
CREATE INDEX "transactions_user_date_idx" ON "transactions" USING btree ("user_id","posted_date");--> statement-breakpoint
CREATE INDEX "transactions_acct_date_idx" ON "transactions" USING btree ("account_id","posted_date");--> statement-breakpoint
CREATE INDEX "transactions_pending_idx" ON "transactions" USING btree ("user_id") WHERE is_pending;