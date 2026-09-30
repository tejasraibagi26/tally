import { describe, it, expect } from "vitest";
import { listingCurrency, holdingPriceCurrency, isMarketQuote } from "./listingCurrency";

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
  it("treats OTC venues as unknown, not USD", () => {
    expect(listingCurrency("OOTC", "VFVXF")).toBeNull();
    expect(listingCurrency("OTCM", "VFVXF")).toBeNull();
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
  it("uses the holding's label when Plaid matched a Canadian ETF's OTC twin", () => {
    // Observed 2026-09-30: Wealthsimple VFV came back as VFVXF / OOTC / USD
    // with the TSX CAD close, in a CAD account.
    expect(
      holdingPriceCurrency({ priceIsMarketPrice: true, mic: "OOTC", ticker: "VFVXF", securityCurrency: "USD", holdingCurrency: "CAD" }),
    ).toBe("CAD");
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

describe("isMarketQuote", () => {
  it("matches an exact or slightly drifted quote", () => {
    expect(isMarketQuote(193.11, 193.11)).toBe(true);
    expect(isMarketQuote(195.4, 193.11)).toBe(true);
  });
  it("rejects a price converted between USD and CAD", () => {
    expect(isMarketQuote(193.11 / 1.39, 193.11)).toBe(false);
    expect(isMarketQuote(100.67 * 1.39, 100.67)).toBe(false);
  });
  it("rejects missing or zero prices", () => {
    expect(isMarketQuote(0, 193.11)).toBe(false);
    expect(isMarketQuote(193.11, null)).toBe(false);
  });
});
