import { describe, expect, it } from "vitest";
import { creditHealth, dateTile, dueLabel, monthsAgo, netWorthDelta, rankBudgets, shortDayLabel, sliceNetWorthRange } from "./overviewView";

describe("dueLabel", () => {
  it("words the distance, and flags today and overdue as urgent", () => {
    expect(dueLabel("2026-10-14", "2026-10-14")).toEqual({ text: "Due today", urgent: true, soon: true });
    expect(dueLabel("2026-10-15", "2026-10-14")).toEqual({ text: "tomorrow", urgent: false, soon: true });
    expect(dueLabel("2026-10-21", "2026-10-14")).toEqual({ text: "in 7 days", urgent: false, soon: true });
    expect(dueLabel("2026-10-22", "2026-10-14")).toEqual({ text: "in 8 days", urgent: false, soon: false });
    expect(dueLabel("2026-10-13", "2026-10-14").text).toBe("Overdue");
  });
  it("counts across a month boundary", () => {
    expect(dueLabel("2026-11-01", "2026-10-30").text).toBe("in 2 days");
  });
});

describe("dateTile / shortDayLabel", () => {
  it("splits a date into month and day", () => {
    expect(dateTile("2026-10-05")).toEqual({ month: "OCT", day: "5" });
  });
  it("labels today, yesterday, then the date, with a year only when it differs", () => {
    expect(shortDayLabel("2026-10-14", "2026-10-14")).toBe("Today");
    expect(shortDayLabel("2026-10-13", "2026-10-14")).toBe("Yesterday");
    expect(shortDayLabel("2026-10-12", "2026-10-14")).toBe("Oct 12");
    expect(shortDayLabel("2025-12-29", "2026-01-02")).toBe("Dec 29, 2025");
  });
});

describe("rankBudgets", () => {
  const b = (amount: number, spend: number, extra: Partial<{ rolloverFromPrior: number; isFixedAmount: boolean }> = {}) => ({
    amount,
    spend,
    rolloverFromPrior: extra.rolloverFromPrior ?? 0,
    isFixedAmount: extra.isFixedAmount ?? false,
  });
  it("puts the most-used first, over-budget ahead of near-budget", () => {
    const lines = [b(30_000, 18_000), b(30_000, 33_800), b(60_000, 51_200)];
    expect(rankBudgets(lines, 3).map((l) => l.spend)).toEqual([33_800, 51_200, 18_000]);
  });
  it("counts rollover as available money", () => {
    const lines = [b(10_000, 10_000, { rolloverFromPrior: 10_000 }), b(10_000, 6_000)];
    expect(rankBudgets(lines, 2)[0]!.spend).toBe(6_000);
  });
  it("skips a paid fixed budget but keeps an unpaid one", () => {
    const paid = b(210_000, 210_000, { isFixedAmount: true });
    const unpaid = b(210_000, 0, { isFixedAmount: true });
    const other = b(10_000, 5_000);
    expect(rankBudgets([paid, other], 3)).toEqual([other]);
    expect(rankBudgets([unpaid, other], 3)).toEqual([other, unpaid]);
  });
  it("applies the limit and treats spend against a zero budget as most at risk", () => {
    const lines = [b(10_000, 1_000), b(0, 500), b(10_000, 2_000)];
    expect(rankBudgets(lines, 2).map((l) => l.spend)).toEqual([500, 2_000]);
  });
});

describe("net worth range", () => {
  it("steps back whole months and clamps short months", () => {
    expect(monthsAgo("2026-10-14", 1)).toBe("2026-09-14");
    expect(monthsAgo("2026-03-31", 1)).toBe("2026-02-28");
    expect(monthsAgo("2026-01-15", 3)).toBe("2025-10-15");
    expect(monthsAgo("2026-10-14", 12)).toBe("2025-10-14");
  });
  const pts = [
    { asOfDate: "2026-08-01", net: 100 },
    { asOfDate: "2026-09-14", net: 200 },
    { asOfDate: "2026-09-20", net: 250 },
    { asOfDate: "2026-10-13", net: 300 },
  ];
  it("slices the series to the range, cutoff day included", () => {
    expect(sliceNetWorthRange(pts, "1M", "2026-10-14").map((p) => p.net)).toEqual([200, 250, 300]);
    expect(sliceNetWorthRange(pts, "3M", "2026-10-14")).toHaveLength(4);
  });
  it("measures the change against the latest snapshot at or before the cutoff", () => {
    expect(netWorthDelta(pts, 300, "1M", "2026-10-14")).toEqual({ direction: "up", cents: 100, pct: 50 });
    expect(netWorthDelta(pts, 150, "1M", "2026-10-14")).toEqual({ direction: "down", cents: 50, pct: 25 });
  });
  it("has no delta without a snapshot that old, or from a zero start", () => {
    expect(netWorthDelta(pts, 300, "6M", "2026-10-14")).toBeUndefined();
    expect(netWorthDelta([{ asOfDate: "2026-09-01", net: 0 }], 300, "1M", "2026-10-14")).toBeUndefined();
  });
});

describe("creditHealth", () => {
  it("switches at 30%", () => {
    expect(creditHealth(0.14)).toEqual({ label: "Healthy", tone: "brand" });
    expect(creditHealth(0.299).label).toBe("Healthy");
    expect(creditHealth(0.3)).toEqual({ label: "High", tone: "warning" });
  });
});
