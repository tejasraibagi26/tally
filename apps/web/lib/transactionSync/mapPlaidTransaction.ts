import type { Transaction as PlaidTransaction } from "plaid";
import { DEFAULT_CURRENCY } from "@tally/core/fx";
import { resolveMerchantName } from "@tally/core/merchantName";

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
  // When Plaid's merchant match shares nothing with the bank's description
  // (resolveMerchantName), its logo, website and counterparties belong to
  // that wrong merchant too -- drop them rather than show a stranger's logo.
  // `raw` keeps Plaid's original either way.
  const merchantName = resolveMerchantName(t.merchant_name, t.name);
  const overruled = merchantName !== (t.merchant_name?.trim() || null);
  return {
    plaidTransactionId: t.transaction_id,
    pendingTransactionId: t.pending_transaction_id ?? null,
    isPending: t.pending,
    amount: toInternalAmountCents(t.amount),
    currency: t.iso_currency_code ?? t.unofficial_currency_code ?? DEFAULT_CURRENCY,
    postedDate: t.date,
    authorizedDate: t.authorized_date ?? null,
    name: t.name,
    merchantName,
    merchantEntityId: overruled ? null : t.merchant_entity_id ?? null,
    logoUrl: overruled ? null : t.logo_url ?? null,
    website: overruled ? null : t.website ?? null,
    paymentChannel: t.payment_channel ?? null,
    pfcPrimary: t.personal_finance_category?.primary ?? null,
    pfcDetailed: t.personal_finance_category?.detailed ?? null,
    pfcConfidence: t.personal_finance_category?.confidence_level ?? null,
    counterparties: overruled ? null : t.counterparties ?? null,
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
