import { describe, it, expect } from "vitest";
import { computeAllocation, computeUtilization, computeSimpleReturn, type HoldingLike, type CreditAccountLike } from "./portfolioMath";

describe("computeAllocation", () => {
  it("sums to 100% across slices", () => {
    const holdings: HoldingLike[] = [
      { institutionValue: 60000, isCashEquivalent: false, assetType: "etf" },
      { institutionValue: 30000, isCashEquivalent: false, assetType: "equity" },
      { institutionValue: 10000, isCashEquivalent: true, assetType: "cash" },
    ];
    const slices = computeAllocation(holdings);
    const totalPct = slices.reduce((sum, s) => sum + s.pct, 0);
    expect(totalPct).toBeCloseTo(1, 10);
  });

  it("groups cash equivalents into their own 'Cash' slice regardless of nominal type", () => {
    const holdings: HoldingLike[] = [
      { institutionValue: 5000, isCashEquivalent: true, assetType: "money market" },
      { institutionValue: 5000, isCashEquivalent: true, assetType: "cash" },
    ];
    const slices = computeAllocation(holdings);
    expect(slices).toHaveLength(1);
    expect(slices[0]).toMatchObject({ label: "Cash", value: 10000, pct: 1 });
  });

  it("returns an empty array for no holdings", () => {
    expect(computeAllocation([])).toEqual([]);
  });

  it("sorts slices largest first", () => {
    const holdings: HoldingLike[] = [
      { institutionValue: 1000, isCashEquivalent: false, assetType: "equity" },
      { institutionValue: 9000, isCashEquivalent: false, assetType: "etf" },
    ];
    expect(computeAllocation(holdings).map((s) => s.label)).toEqual(["ETF", "Equity"]);
  });

  it("formats known Plaid security types for display", () => {
    const holdings: HoldingLike[] = [
      { institutionValue: 1000, isCashEquivalent: false, assetType: "etf" },
      { institutionValue: 1000, isCashEquivalent: false, assetType: "equity" },
      { institutionValue: 1000, isCashEquivalent: false, assetType: "fixed income" },
      { institutionValue: 1000, isCashEquivalent: false, assetType: "mutual fund" },
      { institutionValue: 1000, isCashEquivalent: false, assetType: "cryptocurrency" },
      { institutionValue: 1000, isCashEquivalent: false, assetType: "derivative" },
      { institutionValue: 1000, isCashEquivalent: false, assetType: "loan" },
      { institutionValue: 1000, isCashEquivalent: false, assetType: "other" },
      { institutionValue: 1000, isCashEquivalent: false, assetType: "something new" },
    ];
    expect(computeAllocation(holdings).map((s) => s.label).sort()).toEqual(
      ["Cryptocurrency", "Derivative", "ETF", "Equity", "Fixed Income", "Loan", "Mutual Fund", "Other", "Something New"].sort(),
    );
  });
});

describe("computeUtilization", () => {
  it("computes balance/limit across multiple cards", () => {
    const accounts: CreditAccountLike[] = [
      { currentBalance: 50000, creditLimit: 100000 },
      { currentBalance: 25000, creditLimit: 100000 },
    ];
    const result = computeUtilization(accounts);
    expect(result.utilization).toBeCloseTo(0.375, 10);
    expect(result.excludedCount).toBe(0);
  });

  it("excludes a null-limit card from both sides of the ratio", () => {
    const accounts: CreditAccountLike[] = [
      { currentBalance: 50000, creditLimit: 100000 },
      { currentBalance: 999999, creditLimit: null },
    ];
    const result = computeUtilization(accounts);
    expect(result.utilization).toBe(0.5);
    expect(result.totalBalance).toBe(50000);
    expect(result.excludedCount).toBe(1);
  });

  it("returns null utilization when no card has a known limit", () => {
    const result = computeUtilization([{ currentBalance: 1000, creditLimit: null }]);
    expect(result.utilization).toBeNull();
    expect(result.excludedCount).toBe(1);
  });

  it("returns null utilization for an empty account list rather than dividing by zero", () => {
    expect(computeUtilization([]).utilization).toBeNull();
  });
});

describe("computeSimpleReturn", () => {
  it("is value change minus net contributions", () => {
    expect(computeSimpleReturn(110000, 100000, 5000)).toBe(5000);
  });

  it("can be negative (a real loss, not masked by a deposit)", () => {
    expect(computeSimpleReturn(95000, 100000, 0)).toBe(-5000);
  });
});
