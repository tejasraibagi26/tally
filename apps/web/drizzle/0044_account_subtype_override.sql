-- The user's own call on what kind of account this is, over Plaid's subtype:
-- a second checking account kept as savings is tagged "savings" here. Null
-- means "use Plaid's tag." Only bank (depository) accounts can be overridden,
-- to "checking" or "savings" -- see @tally/core/accountKind. The raw subtype
-- column stays Plaid's so reconnect matching (lib/plaidAccounts.ts,
-- lib/reattach.ts) keeps comparing like with like.
ALTER TABLE "accounts" ADD COLUMN IF NOT EXISTS "subtype_override" text;
