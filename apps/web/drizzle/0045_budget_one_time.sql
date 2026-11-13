-- A one-time budget (a birthday, a trip): it exists only for the month it
-- was set in. The current month's lazy carry-forward (lib/budgets.ts
-- ensureMonthSeeded) and the "copy last month" / "use averages" setup skip
-- it, and its leftover never rolls into next month.
ALTER TABLE "budgets" ADD COLUMN IF NOT EXISTS "is_one_time" boolean DEFAULT false NOT NULL;
