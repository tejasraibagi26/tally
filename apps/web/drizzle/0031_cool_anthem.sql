ALTER TABLE "accounts" ADD COLUMN IF NOT EXISTS "counts_as_cash" boolean;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN IF NOT EXISTS "payment_due_day" integer;--> statement-breakpoint
ALTER TABLE "alert_preferences" ADD COLUMN IF NOT EXISTS "safe_to_spend_low_cents" bigint DEFAULT 10000 NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "safe_to_spend_cushion" bigint DEFAULT 0 NOT NULL;