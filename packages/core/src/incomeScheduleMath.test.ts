import { describe, it, expect } from "vitest";
import { resolvePayDate, payDatesForMonth, duePayDates } from "./incomeScheduleMath";

describe("resolvePayDate", () => {
  it("resolves a plain weekday anchor unchanged", () => {
    // 2026-01-15 is a Thursday
    expect(resolvePayDate(2026, 0, 15)).toBe("2026-01-15");
  });

  it("shifts a Saturday landing back to Friday", () => {
    // 2026-08-15 is a Saturday
    expect(resolvePayDate(2026, 7, 15)).toBe("2026-08-14");
  });

  it("shifts a Sunday landing back to Friday", () => {
    // 2026-02-15 is a Sunday
    expect(resolvePayDate(2026, 1, 15)).toBe("2026-02-13");
  });

  it("resolves anchor 0 to the last day of the month", () => {
    expect(resolvePayDate(2026, 1, 0)).toBe("2026-02-27"); // Feb 2026 has 28 days, the 28th is a Saturday -> Fri 27th
    expect(resolvePayDate(2026, 3, 0)).toBe("2026-04-30");
  });

  it("clamps an anchor past the month's last day", () => {
    expect(resolvePayDate(2026, 1, 31)).toBe("2026-02-27"); // same Feb 28 -> Fri 27 shift as anchor 0
  });
});

describe("payDatesForMonth", () => {
  it("resolves and sorts both semi-monthly anchors", () => {
    expect(payDatesForMonth(2026, 0, [15, 0])).toEqual(["2026-01-15", "2026-01-30"]);
  });

  it("dedupes when two anchors resolve to the same date", () => {
    expect(payDatesForMonth(2026, 3, [30, 0])).toEqual(["2026-04-30"]);
  });
});

describe("duePayDates", () => {
  it("includes this month's already-passed anchor and excludes future ones", () => {
    // Through Jan 20, 2026: the 15th has passed, the 30th hasn't yet.
    expect(duePayDates([15, 0], "2026-01-20", 0)).toEqual(["2026-01-15"]);
  });

  it("catches up a prior month's dates when monthsBack > 0", () => {
    // Through Feb 1, with a 1-month lookback: Jan's 15th and 30th, but not Feb's (both still ahead).
    expect(duePayDates([15, 0], "2026-02-01", 1)).toEqual(["2026-01-15", "2026-01-30"]);
  });
});
