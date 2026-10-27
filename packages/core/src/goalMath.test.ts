import { describe, expect, it } from "vitest";
import { defaultDeadline, monthsLeft, netWorthPace, projectGoal, savingPace, suggestCuts } from "./goalMath";

describe("monthsLeft / defaultDeadline", () => {
  it("counts fractional months to the deadline and stops at 0", () => {
    expect(monthsLeft("2026-10-27", "2026-12-31")).toBeCloseTo(65 / (365.25 / 12), 5);
    expect(monthsLeft("2027-01-02", "2026-12-31")).toBe(0);
    expect(defaultDeadline("2026-10-27")).toBe("2026-12-31");
  });
});

describe("netWorthPace", () => {
  it("averages the last three full months", () => {
    const points = [
      { asOfDate: "2026-06-30", net: 100_000 },
      { asOfDate: "2026-09-30", net: 109_000 },
      { asOfDate: "2026-10-27", net: 115_000 },
    ];
    // End of Sep minus end of Jun, over 3 months; October's partial month is ignored.
    expect(netWorthPace(points, "2026-10-27")).toBe(3_000);
  });
  it("falls back to the history there is, scaled to a month", () => {
    const pace = netWorthPace([{ asOfDate: "2026-09-27", net: 100_000 }, { asOfDate: "2026-10-27", net: 103_000 }], "2026-10-27");
    expect(pace).toBeCloseTo(3_000 * (365.25 / 12 / 30), 5);
  });
  it("is null with under 28 days of history", () => {
    expect(netWorthPace([{ asOfDate: "2026-10-20", net: 1 }, { asOfDate: "2026-10-27", net: 2 }], "2026-10-27")).toBeNull();
    expect(netWorthPace([], "2026-10-27")).toBeNull();
  });
});

describe("savingPace", () => {
  it("averages income − spend over the last three full months", () => {
    const months = [
      { month: "2026-06-01", income: 9, spend: 9 },
      { month: "2026-07-01", income: 500, spend: 200 },
      { month: "2026-08-01", income: 500, spend: 300 },
      { month: "2026-09-01", income: 500, spend: 400 },
      { month: "2026-10-01", income: 0, spend: 999 },
    ];
    expect(savingPace(months, "2026-10-27")).toBe(200);
    expect(savingPace([], "2026-10-27")).toBeNull();
  });
});

describe("projectGoal", () => {
  const base = { target: 200_000, start: 150_000, deadline: "2026-12-31", today: "2026-10-27", saving: 3_000 };
  it("is on track when the projection reaches the target", () => {
    const p = projectGoal({ ...base, current: 186_000, pace: 7_200 });
    expect(p.status).toBe("on_track");
    expect(p.gap).toBe(14_000);
    expect(p.progress).toBeCloseTo(36 / 50, 5);
    expect(p.projected).toBeGreaterThan(200_000);
    expect(p.shortBy).toBeNull();
  });
  it("is off track with the monthly shortfall", () => {
    const p = projectGoal({ ...base, current: 180_000, pace: 4_000 });
    expect(p.status).toBe("off_track");
    expect(p.shortBy).toBeCloseTo(p.neededPerMonth! - 4_000, 5);
  });
  it("reached, ended and unknown", () => {
    expect(projectGoal({ ...base, current: 200_000, pace: 0 }).status).toBe("reached");
    expect(projectGoal({ ...base, today: "2027-01-02", current: 190_000, pace: 1 }).status).toBe("ended");
    expect(projectGoal({ ...base, current: 190_000, pace: null }).status).toBe("unknown");
  });
});

describe("suggestCuts", () => {
  const rows = [
    { key: "shop", label: "Shopping", avgMonthly: 45_000 },
    { key: "dine", label: "Dining", avgMonthly: 60_000 },
    { key: "fun", label: "Entertainment", avgMonthly: 10_000 },
  ];
  it("trims the biggest categories by a fifth until the need is covered", () => {
    expect(suggestCuts(rows, 15_000).map((c) => [c.key, c.save])).toEqual([["dine", 12_000], ["shop", 9_000]]);
    expect(suggestCuts(rows, 0)).toEqual([]);
  });
});
