import { describe, expect, it } from "vitest";
import { merchantLogoKey, ownMerchantLogo } from "./merchantLogo";

describe("ownMerchantLogo", () => {
  it("prefers the transaction's own logo", () => {
    expect(ownMerchantLogo("https://plaid-merchant-logos.plaid.com/uber.png", [{ type: "merchant", logo_url: "https://x/other.png" }])).toBe("https://plaid-merchant-logos.plaid.com/uber.png");
  });

  it("falls back to the merchant counterparty, then any counterparty with a logo", () => {
    expect(ownMerchantLogo(null, [{ type: "payment_app", logo_url: "https://x/paypal.png" }, { type: "merchant", logo_url: "https://x/uber.png" }])).toBe("https://x/uber.png");
    expect(ownMerchantLogo(null, [{ type: "payment_app", logo_url: "https://x/paypal.png" }])).toBe("https://x/paypal.png");
  });

  it("ignores missing, malformed and non-https values", () => {
    expect(ownMerchantLogo(null, null)).toBeNull();
    expect(ownMerchantLogo("http://x/a.png", [{ type: "merchant", logo_url: null }, "junk"])).toBeNull();
  });
});

describe("merchantLogoKey", () => {
  it("normalizes case and spacing, and skips blanks", () => {
    expect(merchantLogoKey(" Uber ")).toBe("uber");
    expect(merchantLogoKey("")).toBeNull();
    expect(merchantLogoKey(null)).toBeNull();
  });
});
