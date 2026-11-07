-- Opting in to the goal view (the Overview bands and Budgets columns built
-- around the year-end goal, plus the quieter skin). Set when the user turns
-- it on, cleared when they turn it off. Null means the classic pages.
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "goal_view_at" timestamp with time zone;
