import { describe, it, expect } from "vitest";
import { buildYearReview, reviewSeason, yearTitle, type YearReviewInput } from "./yearReview";

const months = Array.from({ length: 12 }, (_, i) => ({
  month: `2026-${String(i + 1).padStart(2, "0")}-01`,
  income: 500000,
  spend: 300000 + i * 10000,
}));

function input(overrides: Partial<YearReviewInput> = {}): YearReviewInput {
  return {
    year: 2026,
    today: "2026-10-28",
    months,
    categories: [
      { key: "a", label: "Rent", colorSlot: 1, total: 1_800_000 },
      { key: "b", label: "Dining", colorSlot: 2, total: 600_000 },
      { key: "c", label: "Groceries", colorSlot: 3, total: 600_000 },
    ],
    merchants: [{ key: "x", label: "Loblaws", colorSlot: 3, total: 400_000, count: 52 }],
    netWorthStart: { date: "2026-01-01", net: 5_000_000 },
    netWorthNow: 8_421_562,
    subscriptions: { activeCount: 6, monthlyTotal: 9_100 },
    transactionCount: 812,
    ...overrides,
  };
}

describe("buildYearReview", () => {
  it("counts only months that have started", () => {
    const r = buildYearReview(input());
    expect(r.months).toHaveLength(10);
    expect(r.income).toBe(10 * 500000);
    expect(r.spend).toBe(months.slice(0, 10).reduce((s, m) => s + m.spend, 0));
    expect(r.saved).toBe(r.income - r.spend);
    expect(r.savingsRate).toBeCloseTo(r.saved / r.income);
  });

  it("picks the biggest and calmest from finished months only", () => {
    const r = buildYearReview(input());
    expect(r.biggestMonth?.label).toBe("September"); // October is still running
    expect(r.calmestMonth?.label).toBe("January");
  });

  it("ranks categories with their share of spend", () => {
    const r = buildYearReview(input());
    expect(r.topCategories[0]).toMatchObject({ label: "Rent", share: 0.6 });
  });

  it("says when net worth history starts after January", () => {
    expect(buildYearReview(input()).netWorth).toMatchObject({ change: 3_421_562, fromJan1: true });
    expect(buildYearReview(input({ netWorthStart: { date: "2026-05-12", net: 1 } })).netWorth?.fromJan1).toBe(false);
    expect(buildYearReview(input({ netWorthStart: null })).netWorth).toBeNull();
  });

  it("annualises subscriptions", () => {
    expect(buildYearReview(input()).subscriptions).toEqual({ activeCount: 6, yearlyTotal: 109_200 });
  });

  it("reads as so far until the year ends", () => {
    expect(yearTitle(buildYearReview(input()))).toBe("2026 so far");
    expect(yearTitle(buildYearReview(input({ today: "2027-01-03" })))).toBe("2026");
  });
});

describe("reviewSeason", () => {
  it("is December's year in December and last year's in January", () => {
    expect(reviewSeason("2026-12-02")).toBe(2026);
    expect(reviewSeason("2027-01-15")).toBe(2026);
    expect(reviewSeason("2026-10-28")).toBeNull();
  });
});
