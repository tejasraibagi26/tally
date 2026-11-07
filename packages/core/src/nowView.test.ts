import { describe, expect, it } from "vitest";
import { affordCheck, budgetMood, budgetTally, linePoints, netWorthChange, TIGHT_MARGIN_CENTS, yFor } from "./nowView";

const days = [
  { date: "2026-11-06", balance: 300_000 },
  { date: "2026-11-12", balance: 150_000 },
  { date: "2026-11-20", balance: 330_000 },
  { date: "2026-11-30", balance: 80_000 },
  { date: "2026-12-04", balance: 290_000 },
];

describe("affordCheck", () => {
  it("is null with no projection", () => {
    expect(affordCheck([], 1_000, 0)).toBeNull();
  });
  it("finds the lowest point with nothing bought", () => {
    expect(affordCheck(days, 0, 0)).toEqual({ status: "fine", low: { date: "2026-11-30", amount: 80_000 }, waitUntil: null });
  });
  it("is tight within the margin of the buffer", () => {
    const r = affordCheck(days, 80_000 - TIGHT_MARGIN_CENTS + 1, 0)!;
    expect(r.status).toBe("tight");
    expect(r.low.amount).toBe(TIGHT_MARGIN_CENTS - 1);
  });
  it("is short under the buffer, and says when it would fit", () => {
    const r = affordCheck(days, 100_000, 0)!;
    expect(r.status).toBe("short");
    expect(r.low).toEqual({ date: "2026-11-30", amount: -20_000 });
    // Only Dec 4 onward stays above $0 after $1,000.
    expect(r.waitUntil).toBe("2026-12-04");
  });
  it("has no wait date when even the last day falls short", () => {
    expect(affordCheck(days, 400_000, 0)!.waitUntil).toBeNull();
  });
  it("respects the buffer", () => {
    expect(affordCheck(days, 0, 90_000)!.status).toBe("short");
  });
  it("treats a negative amount as nothing", () => {
    expect(affordCheck(days, -5_000, 0)!.low.amount).toBe(80_000);
  });
});

describe("netWorthChange", () => {
  const points = [
    { asOfDate: "2025-12-01", net: 3_920_000 },
    { asOfDate: "2026-10-31", net: 4_778_000 },
    { asOfDate: "2026-11-05", net: 4_880_000 },
  ];
  it("measures the month from the last snapshot before it began, and the year from the oldest", () => {
    expect(netWorthChange(points, 4_892_000, "2026-11-06")).toEqual({
      month: { amount: 114_000, since: "2026-10-31" },
      year: { amount: 972_000, since: "2025-12-01" },
    });
  });
  it("leaves the year out when history is short", () => {
    expect(netWorthChange(points.slice(1), 4_892_000, "2026-11-06").year).toBeNull();
  });
  it("has nothing to say with no history", () => {
    expect(netWorthChange([], 1, "2026-11-06")).toEqual({ month: null, year: null });
  });
});

describe("budgets", () => {
  const ctx = { phase: "current" as const, daysElapsed: 6, daysInMonth: 30 };
  const line = (spend: number, amount = 10_000, isFixedAmount = false) => ({ amount, rolloverFromPrior: 0, isFixedAmount, spend });
  it("grades a line", () => {
    expect(budgetMood(line(12_000), ctx)).toBe("over");
    expect(budgetMood(line(9_000), ctx)).toBe("close");
    expect(budgetMood(line(1_000), ctx)).toBe("fine");
    expect(budgetMood(line(0, 185_000, true), ctx)).toBe("fixed");
  });
  it("counts everyday budgets and names the ones to watch", () => {
    const t = budgetTally(
      [
        { name: "Eating out", ...line(18_600, 15_000) },
        { name: "Groceries", ...line(41_200, 45_000) },
        { name: "Transit", ...line(2_000, 12_000) },
        { name: "Rent", ...line(0, 185_000, true) },
      ],
      ctx,
    );
    expect(t).toEqual({ over: ["Eating out"], close: ["Groceries"], fine: 1, total: 3 });
  });
});

describe("linePoints / yFor", () => {
  it("spans the width and maps max to the top pad", () => {
    expect(linePoints([0, 10], 100, 50, 5)).toBe("0.0,45.0 100.0,5.0");
    expect(yFor(10, 50, { min: 0, max: 10 }, 5)).toBe(5);
  });
  it("draws a flat line mid-scale-safe and handles one point", () => {
    expect(linePoints([3, 3], 10, 20, 0)).toBe("0.0,20.0 10.0,20.0");
    expect(linePoints([5], 10, 20, 0)).toBe("0.0,20.0");
    expect(linePoints([], 10, 20)).toBe("");
  });
});
