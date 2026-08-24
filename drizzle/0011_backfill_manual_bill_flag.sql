-- Backfills is_manual for recurring_streams rows created via the manual
-- "+ Add a bill" flow (app/api/recurring-streams/route.ts) before that
-- column existed — those rows would otherwise still read is_manual = false
-- (the column's default) and lib/recurringBillGeneration.ts would never
-- post a transaction for them. transaction_ids = '[]' is the safe signal:
-- detectRecurringForUser (lib/recurring.ts) only ever writes a stream once
-- it has 3+ matched transaction ids, so an empty array means this row was
-- never auto-detected — it can only have come from the manual endpoint.
UPDATE "recurring_streams" SET "is_manual" = true WHERE "transaction_ids" = '[]'::jsonb AND "manual_next_due_date" IS NOT NULL;
