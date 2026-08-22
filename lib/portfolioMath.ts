/** Pure portfolio/utilization arithmetic (§9) — no DB import, testable without Postgres. */

export interface HoldingLike {
  institutionValue: number; // cents
  isCashEquivalent: boolean;
  assetType: string; // Security.type — "equity", "etf", "cash", etc.
}

export interface AllocationSlice {
  label: string; // "Cash" for cash equivalents, else the asset type
  value: number; // cents
  pct: number; // 0-1, sums to 1 across the returned array (given at least one holding)
}

/** Groups holdings by asset class per §9 "Allocation" — cash equivalents always get their own slice, regardless of their nominal `type`. */
export function computeAllocation(holdings: HoldingLike[]): AllocationSlice[] {
  const totals = new Map<string, number>();
  for (const h of holdings) {
    const label = h.isCashEquivalent ? "Cash" : h.assetType;
    totals.set(label, (totals.get(label) ?? 0) + h.institutionValue);
  }
  const total = [...totals.values()].reduce((a, b) => a + b, 0);
  if (total === 0) return [];

  return [...totals.entries()]
    .map(([label, value]) => ({ label, value, pct: value / total }))
    .sort((a, b) => b.value - a.value);
}

export interface CreditAccountLike {
  currentBalance: number; // cents, positive = owed
  creditLimit: number | null;
}

export interface UtilizationResult {
  utilization: number | null; // null when no card has a known limit
  totalBalance: number;
  totalLimit: number;
  excludedCount: number; // cards with a null limit, excluded from both sides of the ratio (§6.5)
}

/** Σ balances / Σ limits across cards with a known limit; a null-limit card is excluded from both sides, never treated as zero or unlimited. */
export function computeUtilization(accounts: CreditAccountLike[]): UtilizationResult {
  let totalBalance = 0;
  let totalLimit = 0;
  let excludedCount = 0;

  for (const a of accounts) {
    if (a.creditLimit == null) {
      excludedCount++;
      continue;
    }
    totalBalance += a.currentBalance;
    totalLimit += a.creditLimit;
  }

  return {
    utilization: totalLimit > 0 ? totalBalance / totalLimit : null,
    totalBalance,
    totalLimit,
    excludedCount,
  };
}

/**
 * §9 "Portfolio return": simple value-change-minus-net-contributions, not
 * IRR/TWR. `netContributions` is the sum of investment-transaction cash
 * flows into the account that aren't market activity (buys/sells/dividends
 * net out; a deposit/withdrawal transfer doesn't) — computing which
 * transactions count as a contribution is the caller's job (lib/portfolio.ts
 * or wherever securities data lives); this just does the subtraction so the
 * arithmetic itself has one obvious, tested home.
 */
export function computeSimpleReturn(endValue: number, startValue: number, netContributions: number): number {
  return endValue - startValue - netContributions;
}
