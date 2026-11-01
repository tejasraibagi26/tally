CREATE TABLE IF NOT EXISTS "liabilities_loan" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"interest_rate" numeric(7, 4),
	"next_payment_due_date" date,
	"next_payment_amount" bigint,
	"last_payment_amount" bigint,
	"last_payment_date" date,
	"is_overdue" boolean DEFAULT false NOT NULL,
	"past_due_amount" bigint,
	"origination_principal" bigint,
	"origination_date" date,
	"payoff_date" date,
	"as_of" timestamp with time zone,
	CONSTRAINT "liabilities_loan_account_id_unique" UNIQUE("account_id")
);--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "liabilities_loan" ADD CONSTRAINT "liabilities_loan_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN IF EXISTS "ui_look";
