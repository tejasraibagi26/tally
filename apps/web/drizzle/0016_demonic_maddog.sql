CREATE TABLE "monthly_recaps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"month" date NOT NULL,
	"years_to_fire" numeric(6, 2),
	"sent_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "recaps_enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "monthly_recaps" ADD CONSTRAINT "monthly_recaps_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "monthly_recaps_user_month_idx" ON "monthly_recaps" USING btree ("user_id","month");