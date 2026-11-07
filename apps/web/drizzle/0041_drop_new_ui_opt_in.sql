-- The new Tally (web /new) is gone, and so is its per-account opt-in flag.
-- IF EXISTS so this is a no-op wherever 0040 never ran.
ALTER TABLE "users" DROP COLUMN IF EXISTS "new_ui_at";
