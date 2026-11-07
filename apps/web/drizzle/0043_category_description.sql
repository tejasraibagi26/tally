-- "What it's for": the user's own one-line description of a category, shown
-- under the name on Budgets in the goal view. It belongs to the category
-- rather than to one month's budget row, so it persists without the month
-- seeding having to copy it forward.
--
-- Both tables, because an override is a full snapshot of the editable fields
-- (lib/userCategories.ts): a user's own category is edited in place on
-- categories, a system one becomes a row in category_overrides.
ALTER TABLE "categories" ADD COLUMN IF NOT EXISTS "description" text;
ALTER TABLE "category_overrides" ADD COLUMN IF NOT EXISTS "description" text;
