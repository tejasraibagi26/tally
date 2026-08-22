import { describe, it, expect } from "vitest";
import { monthRange, monthLastDay, shiftMonth, computeRemaining, computeBurnRateProjection } from "./budgetMath";

describe("monthRange", () => {
  it("returns the first of the month through the first of the next month", () => {
    expect(monthRange("2026-02-01")).toEqual({ start: "2026-02-01", end: "2026-03-01" });
  });

  it("handles a December -> January year rollover", () => {
    expect(monthRange("2026-12-01")).toEqual({ start: "2026-12-01", end: "2027-01-01" });
  });
});

describe("monthLastDay", () => {
  it("returns the 28th for a non-leap February", () => {
    expect(monthLastDay("2026-02-01")).toBe("2026-02-28");
  });

  it("returns the 29th for a leap February", () => {
    expect(monthLastDay("2028-02-01")).toBe("2028-02-29");
  });

  it("returns the 31st for a 31-day month", () => {
    expect(monthLastDay("2026-08-01")).toBe("2026-08-31");
  });

  it("handles December", () => {
    expect(monthLastDay("2026-12-01")).toBe("2026-12-31");
  });
});

describe("shiftMonth", () => {
  it("goes back one month within a year", () => {
    expect(shiftMonth("2026-08-01", -1)).toBe("2026-07-01");
  });

  it("goes back across a year boundary", () => {
    expect(shiftMonth("2026-01-01", -1)).toBe("2025-12-01");
  });

  it("goes forward across a year boundary", () => {
    expect(shiftMonth("2026-12-01", 1)).toBe("2027-01-01");
  });
});

describe("computeRemaining", () => {
  it("is amount minus spend with no rollover", () => {
    expect(computeRemaining(50000, 0, 32000)).toBe(18000);
  });

  it("adds rollover before subtracting spend", () => {
    expect(computeRemaining(50000, 10000, 32000)).toBe(28000);
  });

  it("goes negative when over budget, never clamped to zero", () => {
    expect(computeRemaining(50000, 0, 61000)).toBe(-11000);
  });
});

describe("computeBurnRateProjection", () => {
  it("projects linearly to the end of the month", () => {
    expect(computeBurnRateProjection(10000, 10, 30)).toBe(30000);
  });

  it("returns 0 on day zero rather than dividing by zero", () => {
    expect(computeBurnRateProjection(0, 0, 30)).toBe(0);
  });

  it("matches spend-to-date exactly on the last day of the month", () => {
    expect(computeBurnRateProjection(45000, 30, 30)).toBe(45000);
  });
});
