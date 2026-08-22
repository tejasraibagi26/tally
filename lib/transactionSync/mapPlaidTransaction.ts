import type { Transaction as PlaidTransaction } from "plaid";

/**
 * Plaid convention: positive amount = money leaving the account (spend),
 * negative = money coming in. Internal convention (WORK.md §7.3) is the
 * opposite sign: expenses negative, income positive, for every account type.
 * A purchase (Plaid +12.50) becomes -1250 cents; a refund (Plaid -12.50)
 * becomes +1250 cents.
 */
export function toInternalAmountCents(plaidAmount: number): number {
  return -Math.round(plaidAmount * 100);
}

/** Fields Plaid owns — always safe to overwrite on every sync, added or modified. */
export interface PlaidOwnedFields {
  plaidTransactionId: string;
  pendingTransactionId: string | null;
  isPending: boolean;
  amount: number;
  currency: string;
  postedDate: string;
  authorizedDate: string | null;
  name: string;
  merchantName: string | null;
  merchantEntityId: string | null;
  logoUrl: string | null;
  website: string | null;
  paymentChannel: string | null;
  pfcPrimary: string | null;
  pfcDetailed: string | null;
  pfcConfidence: string | null;
  counterparties: unknown;
  location: unknown;
  raw: unknown;
}

export function toPlaidOwnedFields(t: PlaidTransaction): PlaidOwnedFields {
  return {
    plaidTransactionId: t.transaction_id,
    pendingTransactionId: t.pending_transaction_id ?? null,
    isPending: t.pending,
    amount: toInternalAmountCents(t.amount),
    currency: t.iso_currency_code ?? t.unofficial_currency_code ?? "USD",
    postedDate: t.date,
    authorizedDate: t.authorized_date ?? null,
    name: t.name,
    merchantName: t.merchant_name ?? null,
    merchantEntityId: t.merchant_entity_id ?? null,
    logoUrl: t.logo_url ?? null,
    website: t.website ?? null,
    paymentChannel: t.payment_channel ?? null,
    pfcPrimary: t.personal_finance_category?.primary ?? null,
    pfcDetailed: t.personal_finance_category?.detailed ?? null,
    pfcConfidence: t.personal_finance_category?.confidence_level ?? null,
    counterparties: t.counterparties ?? null,
    location: t.location ?? null,
    raw: t,
  };
}

/** User-owned fields — set once a human (or a rule) has made a decision. */
export interface UserOwnedFields {
  categoryId: string | null;
  categorySource: "plaid" | "ml" | "rule" | "manual";
  notes: string | null;
  tags: string[];
  excludedFromBudget: boolean;
}

const DEFAULT_USER_OWNED_FIELDS: UserOwnedFields = {
  categoryId: null,
  categorySource: "plaid",
  notes: null,
  tags: [],
  excludedFromBudget: false,
};

/**
 * Decides what to write for one incoming (added/modified) transaction.
 *
 * Plaid-owned fields always refresh. On first insert, user-owned fields get
 * safe defaults. On an existing row, `notes`/`tags`/`excludedFromBudget` are
 * NEVER included in the result — Plaid has no concept of them, so a
 * `modified` event must never touch them (WORK.md §6.3 non-negotiable).
 * `categoryId`/`categorySource` refresh only while the row is still Plaid's
 * own guess (`category_source: 'plaid'`) — once a rule or a human has
 * claimed it, sync leaves it alone too.
 */
export function mergeTransactionUpdate(
  existing: { categorySource: string } | undefined,
  incoming: PlaidOwnedFields,
): PlaidOwnedFields & Partial<UserOwnedFields> {
  if (!existing) {
    return { ...incoming, ...DEFAULT_USER_OWNED_FIELDS };
  }
  if (existing.categorySource === "manual" || existing.categorySource === "rule") {
    return { ...incoming };
  }
  return {
    ...incoming,
    categoryId: DEFAULT_USER_OWNED_FIELDS.categoryId,
    categorySource: DEFAULT_USER_OWNED_FIELDS.categorySource,
  };
}
