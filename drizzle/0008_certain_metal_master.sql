CREATE TABLE "income_schedules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	"category_id" uuid,
	"label" text DEFAULT 'Paycheck' NOT NULL,
	"amount" bigint NOT NULL,
	"day_anchors" jsonb DEFAULT '[15,0]'::jsonb NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "is_manual" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "income_schedule_id" uuid;--> statement-breakpoint
ALTER TABLE "income_schedules" ADD CONSTRAINT "income_schedules_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "income_schedules" ADD CONSTRAINT "income_schedules_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "income_schedules" ADD CONSTRAINT "income_schedules_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "income_schedules_user_idx" ON "income_schedules" USING btree ("user_id");--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_income_schedule_id_income_schedules_id_fk" FOREIGN KEY ("income_schedule_id") REFERENCES "public"."income_schedules"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "transactions_income_schedule_idx" ON "transactions" USING btree ("income_schedule_id");