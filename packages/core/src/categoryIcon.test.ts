import { describe, expect, it } from "vitest";
import { categoryIconKey, transactionIconKey } from "./categoryIcon";

describe("categoryIconKey", () => {
  it("matches the user's category name first", () => {
    expect(categoryIconKey("Groceries", null)).toBe("shopping-cart");
    expect(categoryIconKey("Coffee shops", "FOOD_AND_DRINK_RESTAURANT")).toBe("coffee");
    expect(categoryIconKey("Dining out", null)).toBe("utensils");
    expect(categoryIconKey("Paycheck", null)).toBe("banknote");
  });

  it("falls back to Plaid's category when the name says nothing", () => {
    expect(categoryIconKey("Misc", "TRANSPORTATION_PUBLIC_TRANSIT_SUBWAY")).toBe("train");
    expect(categoryIconKey(null, "MEDICAL_PHARMACIES_AND_SUPPLEMENTS")).toBe("pill");
  });

  it("ends on a plain tag", () => {
    expect(categoryIconKey("Misc", null)).toBe("tag");
  });

  it("gives transfers and uncategorized rows their own icons", () => {
    expect(transactionIconKey({ categoryName: "Groceries", isTransfer: true })).toBe("arrow-left-right");
    expect(transactionIconKey({ categoryName: null, uncategorized: true })).toBe("circle-help");
  });
});
