import { describe, expect, it } from "vitest";
import { dailyNeed, goalCost, goalCostDays, goalCostTotal } from "./goalCost";

// $2,132 a month over 30 days is $71.07 a day of goal progress.
const NEEDED = 213_200;
const DAYS = 30;
const need = dailyNeed(NEEDED, DAYS)!;

describe("dailyNeed", () => {
  it("splits the monthly requirement over the month", () => {
    expect(need).toBeCloseTo(213_200 / 30);
  });

  it("is null without a live goal", () => {
    expect(dailyNeed(null, DAYS)).toBeNull();
    expect(dailyNeed(0, DAYS)).toBeNull();
    expect(dailyNeed(NEEDED, 0)).toBeNull();
  });
});

describe("goalCostDays", () => {
  it("prices an overage in days, to one decimal", () => {
    expect(goalCostDays(9_075, need)).toBe(1.3);
    expect(goalCostDays(24_900, need)).toBe(3.5);
  });

  it("is zero inside the budget and null without a goal", () => {
    expect(goalCostDays(0, need)).toBe(0);
    expect(goalCostDays(-500, need)).toBe(0);
    expect(goalCostDays(9_075, null)).toBeNull();
  });
});

describe("goalCost", () => {
  it("calls a one-time overage a one-off", () => {
    expect(goalCost({ over: 9_075, neededPerMonth: NEEDED, daysInMonth: DAYS })).toMatchObject({
      kind: "one_off",
      days: 1.3,
      label: "1.3 days",
      note: "one-off, not a rate",
      projectedDays: null,
    });
  });

  it("calls an overage that keeps growing a rate, and names where it ends up", () => {
    expect(goalCost({ over: 9_075, projectedOver: 39_800, neededPerMonth: NEEDED, daysInMonth: DAYS })).toMatchObject({
      kind: "rate",
      days: 1.3,
      projectedDays: 5.6,
      label: "1.3 days",
      note: "and 5.6 at this rate",
    });
  });

  it("warns on a pace that will break a budget still inside it today", () => {
    expect(goalCost({ over: 0, projectedOver: 14_200, neededPerMonth: NEEDED, daysInMonth: DAYS })).toMatchObject({
      kind: "rate",
      days: 0,
      projectedDays: 2,
      label: null,
      note: "2 days at this rate",
    });
  });

  it("costs nothing when the budget is held", () => {
    expect(goalCost({ over: 0, neededPerMonth: NEEDED, daysInMonth: DAYS })).toMatchObject({ kind: "none", days: 0, label: null, note: null });
  });

  it("prices nothing at all without a goal", () => {
    expect(goalCost({ over: 9_075, neededPerMonth: null, daysInMonth: DAYS })).toMatchObject({ kind: "none", days: null, label: null });
  });

  it("writes a single day without the decimal", () => {
    expect(goalCost({ over: Math.round(need), neededPerMonth: NEEDED, daysInMonth: DAYS }).label).toBe("1 day");
  });
});

describe("goalCostTotal", () => {
  it("adds the overages and prices them once", () => {
    expect(goalCostTotal([9_075, 6_600, 9_207], NEEDED, DAYS)).toBe(3.5);
  });

  it("ignores budgets that are under", () => {
    expect(goalCostTotal([9_075, -40_000], NEEDED, DAYS)).toBe(1.3);
  });

  it("is null without a goal", () => {
    expect(goalCostTotal([9_075], null, DAYS)).toBeNull();
  });
});
