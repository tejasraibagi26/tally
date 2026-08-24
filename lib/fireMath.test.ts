import { describe, it, expect } from "vitest";
import { fireNumber, fireProgressPct, yearsToFire, projectionSeries, ageAsOf, fireAgeAndYear } from "./fireMath";

describe("ageAsOf", () => {
  it("counts a full year once the birthday has passed this year", () => {
    expect(ageAsOf("1990-01-15", "2026-06-01")).toBe(36);
  });

  it("hasn't incremented yet if the birthday is later this year", () => {
    expect(ageAsOf("1990-12-15", "2026-06-01")).toBe(35);
  });

  it("counts the birthday itself as the new age", () => {
    expect(ageAsOf("1990-06-01", "2026-06-01")).toBe(36);
  });

  it("the day before a birthday is still the old age", () => {
    expect(ageAsOf("1990-06-01", "2026-05-31")).toBe(35);
  });
});

describe("fireAgeAndYear", () => {
  it("adds fractional years-to-fire onto the current age", () => {
    const result = fireAgeAndYear(35, 12.3, "2026-06-01");
    expect(result.age).toBeCloseTo(47.3, 6);
  });

  it("rounds years-to-fire onto the current calendar year", () => {
    const result = fireAgeAndYear(35, 12.3, "2026-06-01");
    expect(result.year).toBe(2038);
  });

  it("rounds down under half a year", () => {
    expect(fireAgeAndYear(35, 5.2, "2026-06-01").year).toBe(2031);
  });

  it("rounds up at half a year or more", () => {
    expect(fireAgeAndYear(35, 5.5, "2026-06-01").year).toBe(2032);
  });
});

describe("fireNumber", () => {
  it("is 25x annual expenses at the 4% SWR", () => {
    expect(fireNumber(4_000_000, 0.04)).toBeCloseTo(4_000_000 * 25, 6);
  });

  it("is ~33.3x annual expenses at a 3% SWR", () => {
    expect(fireNumber(3_000_000, 0.03)).toBeCloseTo(100_000_000, 6);
  });
});

describe("fireProgressPct", () => {
  it("is 0 at $0 net worth", () => {
    expect(fireProgressPct(0, 100_000_000)).toBe(0);
  });

  it("is 0.5 at half the FIRE number", () => {
    expect(fireProgressPct(50_000_000, 100_000_000)).toBeCloseTo(0.5, 6);
  });

  it("exceeds 1 once past the FIRE number, unclamped", () => {
    expect(fireProgressPct(120_000_000, 100_000_000)).toBeCloseTo(1.2, 6);
  });

  it("is 0 when the FIRE number is 0 (avoids divide-by-zero)", () => {
    expect(fireProgressPct(50_000, 0)).toBe(0);
  });
});

/** Independent brute-force simulation used only to cross-check the closed-form solver below. */
function bruteForceMonths(currentValue: number, monthlyContribution: number, annualReturnRate: number, targetValue: number): number {
  const r = annualReturnRate / 12;
  let value = currentValue;
  let months = 0;
  while (value < targetValue && months < 1_000_000) {
    value = value * (1 + r) + monthlyContribution;
    months++;
  }
  return months;
}

describe("yearsToFire", () => {
  it("reports already-FI when current value meets or exceeds the target", () => {
    expect(yearsToFire({ currentValue: 100_000_000, monthlyContribution: 0, annualReturnRate: 0.07, targetValue: 100_000_000 })).toEqual({
      years: 0,
      alreadyThere: true,
    });
  });

  it("is unreachable at 0% return with no contribution", () => {
    const result = yearsToFire({ currentValue: 1_000_000, monthlyContribution: 0, annualReturnRate: 0, targetValue: 100_000_000 });
    expect(result.years).toBeNull();
    expect(result.alreadyThere).toBe(false);
  });

  it("is exactly linear at 0% return with a positive contribution", () => {
    // Need 99,000,000 more cents at 100,000/mo -> 990 months -> 82.5 years.
    const result = yearsToFire({ currentValue: 1_000_000, monthlyContribution: 100_000, annualReturnRate: 0, targetValue: 100_000_000 });
    expect(result.years).toBeCloseTo(82.5, 6);
  });

  it("solves with a positive return and zero contribution", () => {
    const result = yearsToFire({ currentValue: 25_000_000, monthlyContribution: 0, annualReturnRate: 0.07, targetValue: 100_000_000 });
    expect(result.years).not.toBeNull();
    // ln(4) / ln(1.07/12 monthly) in years — sanity range, not hand-derived to the decimal.
    expect(result.years!).toBeGreaterThan(19);
    expect(result.years!).toBeLessThan(21);
  });

  it("matches an independent brute-force month-by-month simulation within a month, for positive return + contribution", () => {
    const params = { currentValue: 30_000_000, monthlyContribution: 150_000, annualReturnRate: 0.07, targetValue: 125_000_000 };
    const result = yearsToFire(params);
    expect(result.years).not.toBeNull();

    const closedFormMonths = result.years! * 12;
    const bruteMonths = bruteForceMonths(params.currentValue, params.monthlyContribution, params.annualReturnRate, params.targetValue);

    expect(Math.abs(closedFormMonths - bruteMonths)).toBeLessThan(1);
  });

  it("is unreachable when contribution and return are both non-positive and short of target", () => {
    const result = yearsToFire({ currentValue: 1_000_000, monthlyContribution: 0, annualReturnRate: -0.02, targetValue: 100_000_000 });
    expect(result.years).toBeNull();
    expect(result.alreadyThere).toBe(false);
  });

  it("is monotonic: more monthly contribution never increases years to FIRE", () => {
    const base = { currentValue: 10_000_000, monthlyContribution: 50_000, annualReturnRate: 0.06, targetValue: 100_000_000 };
    const more = { ...base, monthlyContribution: 100_000 };
    expect(yearsToFire(more).years!).toBeLessThan(yearsToFire(base).years!);
  });

  it("is monotonic: a higher expected return never increases years to FIRE", () => {
    const base = { currentValue: 10_000_000, monthlyContribution: 50_000, annualReturnRate: 0.05, targetValue: 100_000_000 };
    const higher = { ...base, annualReturnRate: 0.08 };
    expect(yearsToFire(higher).years!).toBeLessThan(yearsToFire(base).years!);
  });
});

describe("projectionSeries", () => {
  it("starts at the current value in year 0", () => {
    const points = projectionSeries({ currentValue: 10_000_000, monthlyContribution: 50_000, annualReturnRate: 0.07, horizonYears: 5 });
    expect(points[0]).toEqual({ year: 0, projectedValue: 10_000_000 });
  });

  it("produces horizonYears + 1 points", () => {
    const points = projectionSeries({ currentValue: 10_000_000, monthlyContribution: 50_000, annualReturnRate: 0.07, horizonYears: 10 });
    expect(points).toHaveLength(11);
  });

  it("is monotonically increasing when contribution is positive", () => {
    const points = projectionSeries({ currentValue: 10_000_000, monthlyContribution: 50_000, annualReturnRate: 0.07, horizonYears: 10 });
    for (let i = 1; i < points.length; i++) {
      expect(points[i]!.projectedValue).toBeGreaterThan(points[i - 1]!.projectedValue);
    }
  });

  it("matches the linear case at 0% return", () => {
    const points = projectionSeries({ currentValue: 1_000_000, monthlyContribution: 10_000, annualReturnRate: 0, horizonYears: 3 });
    expect(points[3]!.projectedValue).toBe(1_000_000 + 10_000 * 36);
  });
});
