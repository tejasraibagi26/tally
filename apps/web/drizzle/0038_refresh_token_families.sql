ALTER TABLE "mobile_refresh_tokens" ADD COLUMN IF NOT EXISTS "family_id" uuid;--> statement-breakpoint
ALTER TABLE "mobile_refresh_tokens" ADD COLUMN IF NOT EXISTS "replaced_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "mobile_refresh_tokens_family_id_idx" ON "mobile_refresh_tokens" ("family_id");
