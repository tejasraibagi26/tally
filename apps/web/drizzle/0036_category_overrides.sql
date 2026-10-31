CREATE TABLE IF NOT EXISTS "category_overrides" (
	"user_id" uuid NOT NULL,
	"category_id" uuid NOT NULL,
	"name" text NOT NULL,
	"color_slot" integer NOT NULL,
	"icon" text,
	"parent_id" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "category_overrides_user_id_category_id_pk" PRIMARY KEY("user_id","category_id")
);--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "category_overrides" ADD CONSTRAINT "category_overrides_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "category_overrides" ADD CONSTRAINT "category_overrides_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
