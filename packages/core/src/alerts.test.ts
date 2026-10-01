import { describe, it, expect } from "vitest";
import { budgetAlerts, largeTransactionAlerts, subscriptionAlerts, connectionAlerts, median, alertDate } from "./alerts";

describe("budgetAlerts", () => {
  const b = (spend: number, limit = 50_000) => [{ categoryId: "c1", categoryName: "Dining", limit, spend }];
  it("nothing under 80%", () => {
    expect(budgetAlerts(b(39_999), "2026-09-01", 11)).toEqual([]);
  });
  it("80% step", () => {
    const [a] = budgetAlerts(b(41_200), "2026-09-01", 11);
    expect(a!.dedupeKey).toBe("budget:c1:2026-09:80");
    expect(a!.title).toBe("Dining is at 82%");
    expect(a!.body).toBe("$412.00 of $500.00 spent, 11 days left.");
    expect(a!.silent).toBe(false);
  });
  it("jumping past 100% records 80% silently and sends 100%", () => {
    const out = budgetAlerts(b(56_000), "2026-09-01", 1);
    expect(out.map((a) => [a.dedupeKey, a.silent])).toEqual([
      ["budget:c1:2026-09:80", true],
      ["budget:c1:2026-09:100", false],
    ]);
    expect(out[1]!.title).toBe("Dining is over budget");
    expect(out[1]!.body).toContain("1 day left");
  });
  it("skips budgets with no limit", () => {
    expect(budgetAlerts(b(10_000, 0), "2026-09-01", 5)).toEqual([]);
  });
});

describe("largeTransactionAlerts", () => {
  const TODAY = "2026-10-01";
  const tx = (amount: number, extra: Partial<Parameters<typeof largeTransactionAlerts>[0][number]> = {}) => ({
    id: "t1", plaidTransactionId: "p1", pendingTransactionId: null, amount, date: "2026-10-01", isTransfer: false,
    merchantKey: "bestbuy", merchantLabel: "Best Buy", accountLabel: "Amex Cobalt ····1004", ...extra,
  });
  it("fires at the threshold", () => {
    const [a] = largeTransactionAlerts([tx(-84_210)], new Map(), 50_000, TODAY);
    expect(a!.title).toBe("$842.10 at Best Buy");
    expect(a!.dedupeKey).toBe("txn:p1");
    expect(a!.body).toBe("Thu, Oct 1 · Amex Cobalt ····1004");
  });
  it("pending and posted rows share a key", () => {
    const [a] = largeTransactionAlerts([tx(-84_210, { plaidTransactionId: "posted", pendingTransactionId: "p1" })], new Map(), 50_000, TODAY);
    expect(a!.dedupeKey).toBe("txn:p1");
  });
  it("ignores income, transfers and small charges", () => {
    expect(largeTransactionAlerts([tx(90_000), tx(-90_000, { isTransfer: true }), tx(-4_000)], new Map(), 50_000, TODAY)).toEqual([]);
  });
  it("fires at 3× the merchant median above $100", () => {
    const hist = new Map([["bestbuy", [4_000, 5_000, 6_000]]]);
    const [a] = largeTransactionAlerts([tx(-15_000)], hist, 50_000, TODAY);
    expect(a!.body).toContain("about 3×");
  });
  it("needs 3 past charges and the $100 floor for the multiple rule", () => {
    expect(largeTransactionAlerts([tx(-15_000)], new Map([["bestbuy", [4_000, 5_000]]]), 50_000, TODAY)).toEqual([]);
    expect(largeTransactionAlerts([tx(-9_000)], new Map([["bestbuy", [1_000, 1_000, 1_000]]]), 50_000, TODAY)).toEqual([]);
  });
  it("ignores charges older than a week (Plaid's historical backfill, relinks)", () => {
    expect(largeTransactionAlerts([tx(-90_000, { date: "2026-08-01" })], new Map(), 50_000, TODAY)).toEqual([]);
    expect(largeTransactionAlerts([tx(-90_000, { date: "2026-09-23" })], new Map(), 50_000, TODAY)).toEqual([]);
  });
  it("still alerts on a charge that posts a few days late", () => {
    expect(largeTransactionAlerts([tx(-90_000, { date: "2026-09-24" })], new Map(), 50_000, TODAY)).toHaveLength(1);
    expect(largeTransactionAlerts([tx(-90_000, { date: "2026-10-01" })], new Map(), 50_000, TODAY)).toHaveLength(1);
  });
  it("adds the year only when it isn't this year", () => {
    expect(alertDate("2026-09-28", "2026-10-01")).toBe("Mon, Sep 28");
    expect(alertDate("2025-12-30", "2026-01-02")).toBe("Tue, Dec 30, 2025");
  });
  it("median", () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 2, 3])).toBe(2.5);
    expect(median([])).toBeNull();
  });
});

describe("subscriptionAlerts", () => {
  const s = (amounts: number[]) => [{
    id: "s1", description: "Spotify", frequency: "monthly" as const,
    charges: amounts.map((amount, i) => ({ amount, date: `2026-0${i + 1}-15` })),
  }];
  it("a stream always yields its new-subscription key", () => {
    const out = subscriptionAlerts(s([-1_199, -1_199, -1_199]), "2026-10-01");
    expect(out.map((a) => a.dedupeKey)).toEqual(["sub_new:s1"]);
    expect(out[0]!.body).toBe("$11.99 a month. Last charged Sun, Mar 15.");
  });
  it("price increase of 5% and $1", () => {
    const out = subscriptionAlerts(s([-1_199, -1_199, -1_399]), "2026-10-01");
    const price = out.find((a) => a.dedupeKey.startsWith("sub_price"))!;
    expect(price.dedupeKey).toBe("sub_price:s1:1399");
    expect(price.body).toBe("$11.99 → $13.99 a month. Charged Sun, Mar 15.");
  });
  it("ignores small changes and decreases", () => {
    expect(subscriptionAlerts(s([-1_199, -1_249]), "2026-10-01").some((a) => a.dedupeKey.startsWith("sub_price"))).toBe(false);
    expect(subscriptionAlerts(s([-1_399, -1_199]), "2026-10-01").some((a) => a.dedupeKey.startsWith("sub_price"))).toBe(false);
  });
});

describe("connectionAlerts", () => {
  it("keys on status and the last good sync, so a later breakage alerts again", () => {
    const at = new Date("2026-09-30T12:00:00Z");
    const [a] = connectionAlerts([{ id: "i1", institutionName: "TD Canada Trust", status: "login_required", lastSyncedAt: at }]);
    expect(a!.title).toBe("TD Canada Trust needs you to sign in again");
    expect(a!.dedupeKey).toBe("conn:i1:login_required:2026-09-30T12:00:00.000Z");
  });
  it("ignores healthy and revoked", () => {
    expect(connectionAlerts([
      { id: "a", institutionName: null, status: "healthy", lastSyncedAt: null },
      { id: "b", institutionName: null, status: "revoked", lastSyncedAt: null },
    ])).toEqual([]);
  });
});
