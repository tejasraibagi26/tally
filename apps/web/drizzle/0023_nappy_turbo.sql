ALTER TABLE "plaid_items" ADD COLUMN "disconnected_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "plaid_items" ADD COLUMN "reattached_at" timestamp with time zone;