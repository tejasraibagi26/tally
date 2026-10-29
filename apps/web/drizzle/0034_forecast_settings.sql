ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "forecast_daily_spend_cents" bigint;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "forecast_days" integer DEFAULT 60 NOT NULL;