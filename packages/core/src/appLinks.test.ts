import { describe, it, expect } from "vitest";
import { appPathForWebPath, appSchemeUrl, isSafeAppPath, openLinkPath } from "./appLinks";

describe("isSafeAppPath", () => {
  it("allows same-site paths only", () => {
    expect(isSafeAppPath("/subscriptions")).toBe(true);
    expect(isSafeAppPath("/transactions?tx=abc")).toBe(true);
    expect(isSafeAppPath("//evil.com")).toBe(false);
    expect(isSafeAppPath("https://evil.com")).toBe(false);
    expect(isSafeAppPath("/\\evil.com")).toBe(false);
    expect(isSafeAppPath("/javascript:alert(1)")).toBe(false);
    expect(isSafeAppPath(null)).toBe(false);
  });
});

describe("links", () => {
  it("builds the open link and the scheme url", () => {
    expect(openLinkPath("/overview?safe=1")).toBe("/open?to=%2Foverview%3Fsafe%3D1");
    expect(appSchemeUrl("/transactions?tx=1")).toBe("tally://transactions?tx=1");
  });
});

describe("appPathForWebPath", () => {
  it.each([
    ["/overview", "/"],
    ["/overview?safe=1", "/?safe=1"],
    ["/transactions?tx=t1", "/transactions/t1"],
    ["/transactions?from=2026-10-01", "/transactions"],
    ["/cards?card=c1", "/card/c1"],
    ["/tags/Japan%202026", "/tag/Japan%202026"],
    ["/settings#alerts", "/alerts"],
    ["/subscriptions", "/subscriptions"],
    ["/budgets", "/budgets"],
    ["/accounts?bank=b1", "/accounts"],
    ["/year-in-review?year=2025", "/year-in-review?year=2025"],
    ["/rules", "/"],
  ])("%s → %s", (web, app) => {
    expect(appPathForWebPath(web)).toBe(app);
  });
});
