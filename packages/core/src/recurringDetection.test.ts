import { describe, it, expect } from "vitest";
import { detectRecurringStreams, normalizeMerchantKey, type RecurringCandidate } from "./recurringDetection";

function tx(overrides: Partial<RecurringCandidate>): RecurringCandidate {
  return {
    id: "t1",
    accountId: "acct_checking",
    categoryId: null,
    merchantKey: "netflix",
    description: "NETFLIX.COM",
    amount: -1549,
    postedDate: "2026-01-01",
    ...overrides,
  };
}

describe("normalizeMerchantKey", () => {
  it("strips a trailing store number", () => {
    expect(normalizeMerchantKey("WHOLEFDS MKT #103")).toBe("wholefds mkt");
  });

  it("strips a trailing reference code after an asterisk", () => {
    expect(normalizeMerchantKey("AMAZON.COM*A1B2C3")).toBe("amazon.com");
  });

  it("lowercases and collapses whitespace", () => {
    expect(normalizeMerchantKey("Netflix   Inc")).toBe("netflix inc");
  });
});

describe("detectRecurringStreams", () => {
  it("does not promote fewer than 3 occurrences", () => {
    const txs = [tx({ id: "1", postedDate: "2026-01-01" }), tx({ id: "2", postedDate: "2026-02-01" })];
    expect(detectRecurringStreams(txs, "2026-02-15")).toHaveLength(0);
  });

  it("promotes 3 monthly-cadence occurrences to an active stream", () => {
    const txs = [
      tx({ id: "1", postedDate: "2026-01-01" }),
      tx({ id: "2", postedDate: "2026-02-01" }),
      tx({ id: "3", postedDate: "2026-03-01" }),
    ];
    const streams = detectRecurringStreams(txs, "2026-03-05");
    expect(streams).toHaveLength(1);
    expect(streams[0]).toMatchObject({ frequency: "monthly", status: "active" });
    expect(streams[0]!.transactionIds).toEqual(["1", "2", "3"]);
  });

  it("classifies a weekly cadence correctly", () => {
    const txs = [
      tx({ id: "1", postedDate: "2026-01-01" }),
      tx({ id: "2", postedDate: "2026-01-08" }),
      tx({ id: "3", postedDate: "2026-01-15" }),
      tx({ id: "4", postedDate: "2026-01-22" }),
    ];
    const streams = detectRecurringStreams(txs, "2026-01-25");
    expect(streams[0]?.frequency).toBe("weekly");
  });

  it("rejects an unstable interval (gaps vary by more than 4 days)", () => {
    const txs = [
      tx({ id: "1", postedDate: "2026-01-01" }),
      tx({ id: "2", postedDate: "2026-01-20" }), // 19 days
      tx({ id: "3", postedDate: "2026-03-01" }), // 40 days
    ];
    expect(detectRecurringStreams(txs, "2026-03-05")).toHaveLength(0);
  });

  it("does not cluster different merchants on the same account together", () => {
    const txs = [
      tx({ id: "1", merchantKey: "netflix", postedDate: "2026-01-01" }),
      tx({ id: "2", merchantKey: "spotify", postedDate: "2026-01-15" }),
      tx({ id: "3", merchantKey: "netflix", postedDate: "2026-02-01" }),
      tx({ id: "4", merchantKey: "spotify", postedDate: "2026-02-15" }),
      tx({ id: "5", merchantKey: "netflix", postedDate: "2026-03-01" }),
      tx({ id: "6", merchantKey: "spotify", postedDate: "2026-03-15" }),
    ];
    const streams = detectRecurringStreams(txs, "2026-03-20");
    expect(streams).toHaveLength(2);
    expect(streams.map((s) => s.merchantKey).sort()).toEqual(["netflix", "spotify"]);
  });

  it("does not cluster the same merchant across two different accounts", () => {
    const txs = [
      tx({ id: "1", accountId: "checking", postedDate: "2026-01-01" }),
      tx({ id: "2", accountId: "credit", postedDate: "2026-01-01" }),
      tx({ id: "3", accountId: "checking", postedDate: "2026-02-01" }),
      tx({ id: "4", accountId: "credit", postedDate: "2026-02-01" }),
      tx({ id: "5", accountId: "checking", postedDate: "2026-03-01" }),
    ];
    // Only "checking" has 3 occurrences.
    expect(detectRecurringStreams(txs, "2026-03-05")).toHaveLength(1);
  });

  it("marks a stream at_risk once it's more than 10 days past the predicted date", () => {
    const txs = [
      tx({ id: "1", postedDate: "2026-01-01" }),
      tx({ id: "2", postedDate: "2026-02-01" }),
      tx({ id: "3", postedDate: "2026-03-01" }),
    ];
    // predicted next ~2026-04-01 (30-day cadence); 12 days past it.
    const streams = detectRecurringStreams(txs, "2026-04-13");
    expect(streams[0]?.status).toBe("at_risk");
  });

  it("marks a stream cancelled after missing roughly two cycles", () => {
    const txs = [
      tx({ id: "1", postedDate: "2026-01-01" }),
      tx({ id: "2", postedDate: "2026-02-01" }),
      tx({ id: "3", postedDate: "2026-03-01" }),
    ];
    const streams = detectRecurringStreams(txs, "2026-05-15");
    expect(streams[0]?.status).toBe("cancelled");
  });

  it("preserves the sign of the amount (expenses negative)", () => {
    const txs = [
      tx({ id: "1", amount: -1200, postedDate: "2026-01-01" }),
      tx({ id: "2", amount: -1200, postedDate: "2026-02-01" }),
      tx({ id: "3", amount: -1200, postedDate: "2026-03-01" }),
    ];
    expect(detectRecurringStreams(txs, "2026-03-05")[0]?.averageAmount).toBe(-1200);
  });

  it("keeps confidence within [0, 1]", () => {
    const txs = [
      tx({ id: "1", postedDate: "2026-01-01" }),
      tx({ id: "2", postedDate: "2026-02-01" }),
      tx({ id: "3", postedDate: "2026-03-01" }),
    ];
    const confidence = detectRecurringStreams(txs, "2026-03-05")[0]!.confidence;
    expect(confidence).toBeGreaterThanOrEqual(0);
    expect(confidence).toBeLessThanOrEqual(1);
  });
});
