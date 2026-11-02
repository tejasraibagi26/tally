-- Date every bank transaction by when the purchase happened (Plaid's
-- authorized_date), not when the bank posted it: a charge made Oct 31 that
-- posts Nov 1 belongs to October. New syncs already store it this way
-- (lib/transactionSync/mapPlaidTransaction.ts). Data only -- no schema
-- change. Plaid's posting date is kept in raw->>'date', so this can be
-- undone with: UPDATE transactions SET posted_date = (raw->>'date')::date
-- WHERE raw ? 'date';
UPDATE "transactions"
SET "posted_date" = "authorized_date"
WHERE "authorized_date" IS NOT NULL
  AND "plaid_transaction_id" IS NOT NULL
  AND "posted_date" <> "authorized_date";
