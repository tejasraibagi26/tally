import { describe, it, expect } from "vitest";
import { trimLeadingEmptyMonths, cashFlowSummary, withCrossings } from "./cashFlowMath";

const m = (month: string, income: number, spend: number) => ({ month, income, spend });

describe("trimLeadingEmptyMonths", () => {
  it("drops months before the first with data, keeps later gaps", () => {
    const out = trimLeadingEmptyMonths([m("2026-01-01", 0, 0), m("2026-02-01", 100, 50), m("2026-03-01", 0, 0), m("2026-04-01", 10, 5)]);
    expect(out.map((x) => x.month)).toEqual(["2026-02-01", "2026-03-01", "2026-04-01"]);
  });
  it("returns nothing when every month is empty", () => {
    expect(trimLeadingEmptyMonths([m("2026-01-01", 0, 0)])).toEqual([]);
  });
});

describe("cashFlowSummary", () => {
  it("averages completed months, excluding the in-progress last month", () => {
    const s = cashFlowSummary([m("a", 1000, 600), m("b", 1000, 800), m("c", 200, 900)]);
    expect(s.avgSaved).toBe(300);
    expect(s.savingsRate).toBeCloseTo(0.3);
    expect(s.monthsCounted).toBe(2);
  });
  it("uses the only month when it's all there is", () => {
    expect(cashFlowSummary([m("a", 1000, 400)]).avgSaved).toBe(600);
  });
  it("has no savings rate without income", () => {
    expect(cashFlowSummary([m("a", 0, 100), m("b", 0, 0)]).savingsRate).toBeNull();
  });
});

describe("withCrossings", () => {
  it("inserts the exact crossing between months where the lines cross", () => {
    const pts = withCrossings([m("a", 100, 50), m("b", 100, 150)]);
    expect(pts).toHaveLength(3);
    expect(pts[1]).toMatchObject({ x: 0.5, income: 100, spend: 100, crossing: true });
  });
  it("adds nothing when the lines don't cross", () => {
    expect(withCrossings([m("a", 100, 50), m("b", 120, 60)])).toHaveLength(2);
  });
});
