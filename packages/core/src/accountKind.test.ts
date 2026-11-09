import { describe, expect, it } from "vitest";
import { accountKindLabel, effectiveSubtype, isValidKindOverride, kindOptions } from "./accountKind";
import { countsAsCashByDefault } from "./safeToSpend";

describe("accountKind", () => {
  it("offers checking and savings for bank accounts only", () => {
    expect(kindOptions("depository")).toEqual(["checking", "savings"]);
    expect(kindOptions("credit")).toEqual([]);
    expect(kindOptions("investment")).toEqual([]);
  });

  it("validates an override against the account's type", () => {
    expect(isValidKindOverride("depository", "savings")).toBe(true);
    expect(isValidKindOverride("depository", "loan")).toBe(false);
    expect(isValidKindOverride("credit", "savings")).toBe(false);
  });

  it("lets the override win, and falls back to Plaid's tag", () => {
    expect(effectiveSubtype("depository", "checking", "savings")).toBe("savings");
    expect(effectiveSubtype("depository", "checking", null)).toBe("checking");
    expect(effectiveSubtype("depository", null, undefined)).toBe(null);
  });

  it("ignores an override that doesn't fit the type", () => {
    expect(effectiveSubtype("credit", "credit card", "savings")).toBe("credit card");
  });

  it("a checking account tagged as savings stops counting as spending money", () => {
    expect(countsAsCashByDefault("depository", effectiveSubtype("depository", "checking", null))).toBe(true);
    expect(countsAsCashByDefault("depository", effectiveSubtype("depository", "checking", "savings"))).toBe(false);
    expect(countsAsCashByDefault("depository", effectiveSubtype("depository", "savings", "checking"))).toBe(true);
  });

  it("labels kinds", () => {
    expect(accountKindLabel("depository", "savings")).toBe("Savings");
    expect(accountKindLabel("investment", "tfsa")).toBe("TFSA");
    expect(accountKindLabel("credit", "credit_card")).toBe("Credit card");
    expect(accountKindLabel("loan", null)).toBe("Loan");
  });
});
