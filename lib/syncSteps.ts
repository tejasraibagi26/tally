export type SyncProduct = "balances" | "transactions" | "holdings" | "investments" | "liabilities";

export interface SyncFailure {
  product: SyncProduct;
  label: string;
}

const PRODUCT_LABEL: Record<SyncProduct, string> = {
  balances: "account balances",
  transactions: "transactions",
  holdings: "investment holdings",
  investments: "investment transactions",
  liabilities: "credit card details",
};

/**
 * Runs one sync step in isolation and records a labeled failure instead of
 * throwing — so one product being down (e.g. Plaid's INSTITUTION_NOT_RESPONDING
 * for a single institution) doesn't abort the steps after it, and the caller
 * ends up with a complete, user-presentable list of what didn't come through.
 * The step's own sync function already logs the specific Plaid error code;
 * this only tracks that it failed, not why.
 */
export async function runSyncStep<T>(product: SyncProduct, fn: () => Promise<T>, failures: SyncFailure[]): Promise<T | undefined> {
  try {
    return await fn();
  } catch {
    failures.push({ product, label: PRODUCT_LABEL[product] });
    return undefined;
  }
}
