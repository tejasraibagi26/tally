import { describe, expect, it } from "vitest";
import { budgetRunway, type RunwayContext, type RunwayInput } from "./budgetRunway";

const money = (c: number) => `$${Math.round(c / 100)}`;
const day7: RunwayContext = { daysElapsed: 7, daysInMonth: 30 };
const line = (available: number, spend: number, isFixedAmount = false): RunwayInput => ({ available, spend, isFixedAmount });

describe("budgetRunway", () => {
  it("carries past month end when the rate leaves room", () => {
    const r = budgetRunway(line(65_000, 13_820), day7, money);
    expect(r).toMatchObject({ state: "carries", left: 51_180, runsOutDay: null });
    expect(r.sentence).toBe("Carries past month end. $21 a day to the 30th.");
    // The bar reaches the right edge: behind you plus carried covers the month.
    expect(r.todayPct + r.carryPct).toBeCloseTo(1);
  });

  it("runs dry well before month end, and names the day and both rates", () => {
    const r = budgetRunway(line(24_000, 14_675), day7, money);
    expect(r).toMatchObject({ state: "runs_dry", runsOutDay: 11 });
    expect(r.sentence).toBe("Runs dry on the 11th. You're going $21 a day; reaching the 30th needs $4 a day.");
    expect(r.carryPct).toBeCloseTo(4.449 / 30, 2);
  });

  it("lands short rather than running dry inside the grace window", () => {
    const r = budgetRunway(line(20_000, 4_800), day7, money);
    expect(r).toMatchObject({ state: "lands_short", runsOutDay: 29 });
    expect(r.sentence).toBe("Lands on the 29th, 1 day shy. $6 a day holds it to the end.");
  });

  it("reports an overage with the day it happened on, and no allowance", () => {
    const r = budgetRunway(line(7_000, 7_840), day7, money);
    expect(r).toMatchObject({ state: "over", left: -840, allowance: null, carryPct: 0 });
    expect(r.sentence).toBe("$8 over, on day 7.");
  });

  it("projects no rate for an untouched budget", () => {
    const r = budgetRunway(line(9_000, 0), day7, money);
    expect(r).toMatchObject({ state: "untouched", rate: null });
    expect(r.sentence).toBe("Untouched. The whole $90 is still there, and there is no rate to project yet.");
    expect(r.todayPct + r.carryPct).toBeCloseTo(1);
  });

  it("treats a fixed amount as settled, not as a runway", () => {
    expect(budgetRunway(line(8_697, 8_697, true), day7, money)).toMatchObject({
      state: "fixed",
      rate: null,
      allowance: null,
      sentence: "Paid in full. Nothing here is still a decision.",
    });
    expect(budgetRunway(line(8_697, 4_000, true), day7, money).sentence).toBe("$40 of $87 paid so far.");
    expect(budgetRunway(line(8_697, 0, true), day7, money).sentence).toBe("Not paid yet. $87 is set aside for it.");
  });

  it("says nothing about pace for a month that is not in progress", () => {
    const r = budgetRunway(line(65_000, 60_000), { daysInMonth: 30 }, money);
    expect(r).toMatchObject({ state: "not_current", rate: null, allowance: null, carryPct: 0, todayPct: 0 });
    expect(r.sentence).toBe("$650 budgeted.");
  });

  it("writes the ordinal correctly on the 2nd, 3rd and teens", () => {
    const on = (day: number, available: number, spend: number) => budgetRunway(line(available, spend), { daysElapsed: day, daysInMonth: 31 }, money).sentence;
    expect(on(1, 10_000, 4_500)).toContain("on the 2nd");
    expect(on(2, 10_000, 6_000)).toContain("on the 3rd");
    expect(on(10, 10_000, 8_000)).toContain("on the 13th");
    // Already gone today: the runway ends on today, it never reads as the past.
    expect(on(1, 10_000, 9_000)).toContain("on the 1st");
  });
});

describe("budgetRunway emphasis", () => {
  const every: [string, ReturnType<typeof budgetRunway>][] = [
    ["carries", budgetRunway(line(65_000, 13_820), day7, money)],
    ["runs dry", budgetRunway(line(24_000, 14_675), day7, money)],
    ["lands short", budgetRunway(line(20_000, 4_800), day7, money)],
    ["over", budgetRunway(line(7_000, 7_840), day7, money)],
    ["untouched", budgetRunway(line(9_000, 0), day7, money)],
    ["fixed paid", budgetRunway(line(8_697, 8_697, true), day7, money)],
    ["fixed part-paid", budgetRunway(line(8_697, 4_000, true), day7, money)],
    ["fixed unpaid", budgetRunway(line(8_697, 0, true), day7, money)],
    ["not current", budgetRunway(line(65_000, 60_000), { daysInMonth: 30 }, money)],
  ];

  it.each(every)("%s joins its parts back into the plain sentence", (_name, r) => {
    expect(r.parts.map((p) => p.text).join("")).toBe(r.sentence);
  });

  it.each(every)("%s marks something worth bolding, but not everything", (_name, r) => {
    const strong = r.parts.filter((p) => p.strong);
    expect(strong.length).toBeGreaterThan(0);
    expect(strong.length).toBeLessThan(r.parts.length);
  });

  it("bolds the verdict and the figure it hangs on", () => {
    const dry = budgetRunway(line(24_000, 14_675), day7, money);
    expect(dry.parts.find((p) => p.strong)?.text).toBe("Runs dry on the 11th");
    const carries = budgetRunway(line(65_000, 13_820), day7, money);
    expect(carries.parts.find((p) => p.strong)?.text).toBe(" $21 a day");
  });
});
