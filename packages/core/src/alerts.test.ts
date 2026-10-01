import { describe, it, expect } from "vitest";
import { budgetAlerts, largeTransactionAlerts, subscriptionAlerts, connectionAlerts, deliverAfter, median } from "./alerts";

describe("budgetAlerts", () => {
  const b = (spend: number, limit = 50_000) => [{ categoryId: "c1", categoryName: "Dining", limit, spend }];
  it("nothing under 80%", () => {
    expect(budgetAlerts(b(39_999), "2026-09-01", 11)).toEqual([]);
  });
  it("80% step with amounts and a no-amounts variant", () => {
    const [a] = budgetAlerts(b(41_200), "2026-09-01", 11);
    expect(a!.dedupeKey).toBe("budget:c1:2026-09:80");
    expect(a!.title).toBe("Dining is at 82%");
    expect(a!.body).toBe("$412.00 of $500.00 spent, 11 days left.");
    expect(a!.bodyNoAmounts).toBe("82% of this month's budget, 11 days left.");
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
  const tx = (amount: number, extra: Partial<Parameters<typeof largeTransactionAlerts>[0][number]> = {}) => ({
    id: "t1", plaidTransactionId: "p1", pendingTransactionId: null, amount, isTransfer: false,
    merchantKey: "bestbuy", merchantLabel: "Best Buy", accountLabel: "Amex Cobalt ····1004", ...extra,
  });
  it("fires at the threshold", () => {
    const [a] = largeTransactionAlerts([tx(-84_210)], new Map(), 50_000);
    expect(a!.title).toBe("$842.10 at Best Buy");
    expect(a!.dedupeKey).toBe("txn:p1");
  });
  it("pending and posted rows share a key", () => {
    const [a] = largeTransactionAlerts([tx(-84_210, { plaidTransactionId: "posted", pendingTransactionId: "p1" })], new Map(), 50_000);
    expect(a!.dedupeKey).toBe("txn:p1");
  });
  it("ignores income, transfers and small charges", () => {
    expect(largeTransactionAlerts([tx(90_000), tx(-90_000, { isTransfer: true }), tx(-4_000)], new Map(), 50_000)).toEqual([]);
  });
  it("fires at 3× the merchant median above $100", () => {
    const hist = new Map([["bestbuy", [4_000, 5_000, 6_000]]]);
    const [a] = largeTransactionAlerts([tx(-15_000)], hist, 50_000);
    expect(a!.body).toContain("about 3×");
  });
  it("needs 3 past charges and the $100 floor for the multiple rule", () => {
    expect(largeTransactionAlerts([tx(-15_000)], new Map([["bestbuy", [4_000, 5_000]]]), 50_000)).toEqual([]);
    expect(largeTransactionAlerts([tx(-9_000)], new Map([["bestbuy", [1_000, 1_000, 1_000]]]), 50_000)).toEqual([]);
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
    const out = subscriptionAlerts(s([-1_199, -1_199, -1_199]));
    expect(out.map((a) => a.dedupeKey)).toEqual(["sub_new:s1"]);
    expect(out[0]!.body).toBe("$11.99 a month.");
  });
  it("price increase of 5% and $1", () => {
    const out = subscriptionAlerts(s([-1_199, -1_199, -1_399]));
    const price = out.find((a) => a.dedupeKey.startsWith("sub_price"))!;
    expect(price.dedupeKey).toBe("sub_price:s1:1399");
    expect(price.body).toBe("$11.99 → $13.99 a month.");
  });
  it("ignores small changes and decreases", () => {
    expect(subscriptionAlerts(s([-1_199, -1_249])).some((a) => a.dedupeKey.startsWith("sub_price"))).toBe(false);
    expect(subscriptionAlerts(s([-1_399, -1_199])).some((a) => a.dedupeKey.startsWith("sub_price"))).toBe(false);
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

describe("deliverAfter", () => {
  const tz = "America/Toronto";
  it("sends now during the day", () => {
    const noon = new Date("2026-09-30T16:00:00Z"); // 12:00 EDT
    expect(deliverAfter(noon, tz)).toEqual(noon);
  });
  it("holds a late-evening alert until 08:00 the next morning", () => {
    expect(deliverAfter(new Date("2026-10-01T03:00:00Z"), tz).toISOString()).toBe("2026-10-01T12:00:00.000Z"); // 23:00 → 08:00 EDT
  });
  it("holds an early-morning alert until 08:00 the same day", () => {
    expect(deliverAfter(new Date("2026-10-01T09:00:00Z"), tz).toISOString()).toBe("2026-10-01T12:00:00.000Z"); // 05:00 → 08:00 EDT
  });
  it("handles the DST fall-back night", () => {
    // 23:30 EDT on Oct 31; clocks fall back overnight, so 08:00 EST on Nov 1 is 13:00Z.
    expect(deliverAfter(new Date("2026-11-01T03:30:00Z"), tz).toISOString()).toBe("2026-11-01T13:00:00.000Z");
  });
});
