CREATE TABLE "fire_settings" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"swr" numeric(5, 4) NOT NULL,
	"expected_return" numeric(5, 4) NOT NULL,
	"annual_expenses_override" bigint,
	"monthly_contribution_override" bigint,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "fire_settings" ADD CONSTRAINT "fire_settings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;