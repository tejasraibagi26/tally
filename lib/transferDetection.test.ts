import { describe, it, expect } from "vitest";
import { findTransferPairs, type TransferCandidate } from "./transferDetection";

function cand(overrides: Partial<TransferCandidate> = {}): TransferCandidate {
  return { id: "t1", accountId: "checking", amount: -50000, postedDate: "2026-08-10", ...overrides };
}

describe("findTransferPairs", () => {
  it("pairs a same-day, equal-magnitude, opposite-sign, cross-account pair", () => {
    const out = cand({ id: "out", accountId: "checking", amount: -50000, postedDate: "2026-08-10" });
    const inn = cand({ id: "in", accountId: "savings", amount: 50000, postedDate: "2026-08-10" });
    const pairs = findTransferPairs([out, inn]);
    expect(pairs).toHaveLength(1);
    expect(new Set([pairs[0]!.a.id, pairs[0]!.b.id])).toEqual(new Set(["out", "in"]));
  });

  it("pairs within the 4-day window", () => {
    const out = cand({ id: "out", accountId: "checking", amount: -1000, postedDate: "2026-08-10" });
    const inn = cand({ id: "in", accountId: "credit", amount: 1000, postedDate: "2026-08-13" });
    expect(findTransferPairs([out, inn])).toHaveLength(1);
  });

  it("does not pair once the gap exceeds 4 days", () => {
    const out = cand({ id: "out", accountId: "checking", amount: -1000, postedDate: "2026-08-10" });
    const inn = cand({ id: "in", accountId: "credit", amount: 1000, postedDate: "2026-08-15" });
    expect(findTransferPairs([out, inn])).toHaveLength(0);
  });

  it("does not pair transactions on the same account", () => {
    const a = cand({ id: "a", accountId: "checking", amount: -1000, postedDate: "2026-08-10" });
    const b = cand({ id: "b", accountId: "checking", amount: 1000, postedDate: "2026-08-10" });
    expect(findTransferPairs([a, b])).toHaveLength(0);
  });

  it("does not pair two transactions with the same sign", () => {
    const a = cand({ id: "a", accountId: "checking", amount: -1000, postedDate: "2026-08-10" });
    const b = cand({ id: "b", accountId: "credit", amount: -1000, postedDate: "2026-08-10" });
    expect(findTransferPairs([a, b])).toHaveLength(0);
  });

  it("allows amounts within 1% tolerance", () => {
    const out = cand({ id: "out", accountId: "checking", amount: -100000, postedDate: "2026-08-10" });
    const inn = cand({ id: "in", accountId: "credit", amount: 100900, postedDate: "2026-08-10" }); // 0.9% off
    expect(findTransferPairs([out, inn])).toHaveLength(1);
  });

  it("rejects amounts outside 1% tolerance", () => {
    const out = cand({ id: "out", accountId: "checking", amount: -100000, postedDate: "2026-08-10" });
    const inn = cand({ id: "in", accountId: "credit", amount: 102000, postedDate: "2026-08-10" }); // 2% off
    expect(findTransferPairs([out, inn])).toHaveLength(0);
  });

  it("pairs non-card account types too (checking <-> savings, checking <-> brokerage)", () => {
    const out = cand({ id: "out", accountId: "checking", amount: -20000, postedDate: "2026-08-10" });
    const inn = cand({ id: "in", accountId: "brokerage", amount: 20000, postedDate: "2026-08-10" });
    expect(findTransferPairs([out, inn])).toHaveLength(1);
  });

  it("uses each candidate at most once, preferring the earliest valid match", () => {
    const out = cand({ id: "out", accountId: "checking", amount: -1000, postedDate: "2026-08-10" });
    const in1 = cand({ id: "in1", accountId: "savings", amount: 1000, postedDate: "2026-08-10" });
    const in2 = cand({ id: "in2", accountId: "credit", amount: 1000, postedDate: "2026-08-11" });
    const pairs = findTransferPairs([out, in1, in2]);
    expect(pairs).toHaveLength(1);
    expect(pairs[0]!.b.id).toBe("in1");
  });

  it("returns no pairs for an empty or single-item list", () => {
    expect(findTransferPairs([])).toHaveLength(0);
    expect(findTransferPairs([cand()])).toHaveLength(0);
  });
});
