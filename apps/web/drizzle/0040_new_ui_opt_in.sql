-- Opting in to the new Tally (web /new): set when the user turns it on,
-- cleared when they switch back to classic. Null means classic.
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "new_ui_at" timestamp with time zone;
