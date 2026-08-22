import { describe, it, expect } from "vitest";
import { toInternalAmountCents, mergeTransactionUpdate, type PlaidOwnedFields } from "./mapPlaidTransaction";

function plaidOwned(overrides: Partial<PlaidOwnedFields> = {}): PlaidOwnedFields {
  return {
    plaidTransactionId: "txn_1",
    pendingTransactionId: null,
    isPending: false,
    amount: -8642,
    currency: "USD",
    postedDate: "2026-08-14",
    authorizedDate: "2026-08-14",
    name: "Whole Foods Market",
    merchantName: "Whole Foods Market",
    merchantEntityId: null,
    logoUrl: null,
    website: null,
    paymentChannel: "in store",
    pfcPrimary: "FOOD_AND_DRINK",
    pfcDetailed: "FOOD_AND_DRINK_GROCERIES",
    pfcConfidence: "VERY_HIGH",
    counterparties: null,
    location: null,
    raw: {},
    ...overrides,
  };
}

describe("toInternalAmountCents", () => {
  it("flips a Plaid purchase (positive = money out) to a negative expense", () => {
    expect(toInternalAmountCents(86.42)).toBe(-8642);
  });

  it("flips a Plaid refund/income (negative = money in) to a positive amount", () => {
    expect(toInternalAmountCents(-1500)).toBe(150000);
  });

  it("rounds sub-cent floating point noise", () => {
    expect(toInternalAmountCents(19.999999999998)).toBe(-2000);
  });
});

describe("mergeTransactionUpdate", () => {
  it("applies Plaid-owned fields plus safe defaults on first insert", () => {
    const result = mergeTransactionUpdate(undefined, plaidOwned());
    expect(result.categorySource).toBe("plaid");
    expect(result.categoryId).toBeNull();
    expect(result.notes).toBeNull();
    expect(result.tags).toEqual([]);
    expect(result.excludedFromBudget).toBe(false);
  });

  it("refreshes category on a modified event while the row is still Plaid's own guess", () => {
    const result = mergeTransactionUpdate({ categorySource: "plaid" }, plaidOwned());
    expect(result.categorySource).toBe("plaid");
    expect(result.categoryId).toBeNull();
  });

  it("never includes notes/tags/excludedFromBudget for an existing row — Plaid has no concept of them", () => {
    const result = mergeTransactionUpdate({ categorySource: "plaid" }, plaidOwned());
    expect("notes" in result).toBe(false);
    expect("tags" in result).toBe(false);
    expect("excludedFromBudget" in result).toBe(false);
  });

  it("never overwrites a manually-set category on a modified event (the core M2 non-negotiable)", () => {
    const result = mergeTransactionUpdate({ categorySource: "manual" }, plaidOwned({ name: "WHOLEFDS #10234" }));
    expect("categoryId" in result).toBe(false);
    expect("categorySource" in result).toBe(false);
    // Plaid-owned fields still refresh even though the category is locked.
    expect(result.name).toBe("WHOLEFDS #10234");
  });

  it("never overwrites a rule-set category on a modified event", () => {
    const result = mergeTransactionUpdate({ categorySource: "rule" }, plaidOwned());
    expect("categoryId" in result).toBe(false);
    expect("categorySource" in result).toBe(false);
  });

  it("still refreshes Plaid-owned fields (amount, pending state) regardless of category lock", () => {
    const result = mergeTransactionUpdate(
      { categorySource: "manual" },
      plaidOwned({ isPending: false, pendingTransactionId: null, amount: -9000 }),
    );
    expect(result.isPending).toBe(false);
    expect(result.amount).toBe(-9000);
  });
});
