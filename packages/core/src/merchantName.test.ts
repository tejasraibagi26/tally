import { describe, expect, it } from "vitest";
import { cleanDescription, merchantRenameKey, namesAgree, resolveMerchantName } from "./merchantName";

describe("namesAgree", () => {
  it.each([
    ["Starbucks", "STARBUCKS #4021"],
    ["Whole Foods Market", "WHOLEFDS MKT #103"],
    ["Amazon", "AMZN Mktp CA*1A2B3"],
    ["McDonald's", "MCDONALDS F1234"],
    ["Rogers", "RGRS WIRELESS"],
    ["Acme Co", "PAYROLL DEP ACME CO"],
    ["eBay", "PAYPAL *EBAY"],
  ])("%s matches %s", (merchant, description) => {
    expect(namesAgree(merchant, description)).toBe(true);
  });

  it("rejects an unrelated match", () => {
    expect(namesAgree("Child Net", "SONNET INSURANCE")).toBe(false);
  });
});

describe("cleanDescription", () => {
  it("drops store numbers, processor prefixes and caps", () => {
    expect(cleanDescription("SONNET INSURANCE")).toBe("Sonnet Insurance");
    expect(cleanDescription("SQ *JOES COFFEE 4421")).toBe("Joes Coffee");
    expect(cleanDescription("TST* Pizza Nova #12")).toBe("Pizza Nova");
  });
});

describe("resolveMerchantName", () => {
  it("keeps Plaid's name when it agrees with the description", () => {
    expect(resolveMerchantName("Starbucks", "STARBUCKS #4021")).toBe("Starbucks");
  });

  it("uses the description when Plaid's name is unrelated", () => {
    expect(resolveMerchantName("Child Net", "SONNET INSURANCE")).toBe("Sonnet Insurance");
  });

  it("keeps Plaid's name when the description is only codes or filler", () => {
    expect(resolveMerchantName("Tim Hortons", "POS PURCHASE 4829")).toBe("Tim Hortons");
    expect(resolveMerchantName("BP", "BP#1234")).toBe("BP");
  });

  it("is null without a Plaid merchant", () => {
    expect(resolveMerchantName(null, "E-TRANSFER SENT")).toBeNull();
    expect(resolveMerchantName("  ", "X")).toBeNull();
  });
});

describe("merchantRenameKey", () => {
  it("normalizes case and spacing, and skips blanks", () => {
    expect(merchantRenameKey("  Sonnet   Insurance ")).toBe("sonnet insurance");
    expect(merchantRenameKey("")).toBeNull();
    expect(merchantRenameKey(null)).toBeNull();
  });
});
