import { describe, it, expect } from "vitest";
import { listingCurrency, holdingPriceCurrency } from "./listingCurrency";

describe("listingCurrency", () => {
  it("maps Canadian exchanges to CAD", () => {
    expect(listingCurrency("XTSE", "VFV")).toBe("CAD");
    expect(listingCurrency("xtse", "VFV")).toBe("CAD");
  });
  it("treats TSX .U share classes as USD", () => {
    expect(listingCurrency("XTSE", "VFV.U")).toBe("USD");
  });
  it("maps US exchanges to USD", () => {
    expect(listingCurrency("XNAS", "MU")).toBe("USD");
    expect(listingCurrency("XNYS", "BRK.B")).toBe("USD");
  });
  it("returns null for unknown or missing exchanges", () => {
    expect(listingCurrency(null, "VFV")).toBeNull();
    expect(listingCurrency("XLON", "VOD")).toBeNull();
  });
});

describe("holdingPriceCurrency", () => {
  it("uses the listing currency over a wrong USD label on a TSX market price", () => {
    expect(
      holdingPriceCurrency({ priceIsMarketPrice: true, mic: "XTSE", ticker: "VFV", securityCurrency: "USD", holdingCurrency: "USD" }),
    ).toBe("CAD");
  });
  it("keeps a US stock's market price in USD even when the holding is labeled CAD", () => {
    expect(
      holdingPriceCurrency({ priceIsMarketPrice: true, mic: "XNAS", ticker: "MU", securityCurrency: "USD", holdingCurrency: "CAD" }),
    ).toBe("USD");
  });
  it("falls back to the security's label when the exchange is unknown", () => {
    expect(holdingPriceCurrency({ priceIsMarketPrice: true, mic: null, ticker: "VCN", securityCurrency: "CAD", holdingCurrency: "USD" })).toBe("CAD");
  });
  it("trusts the holding's own label when the institution priced it itself", () => {
    expect(
      holdingPriceCurrency({ priceIsMarketPrice: false, mic: "XNAS", ticker: "MU", securityCurrency: "USD", holdingCurrency: "CAD" }),
    ).toBe("CAD");
  });
});
