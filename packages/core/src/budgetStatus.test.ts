import { describe, expect, it } from "vitest";
import { budgetRunway } from "./budgetRunway";
import { budgetStatus, goalCostSuffix } from "./budgetStatus";
import { goalCost } from "./goalCost";

const fmt = (c: number) => `$${Math.round(c / 100)}`;
const month = "2026-11-01";
const ctx = { daysElapsed: 9, daysInMonth: 30 };
const noGoal = goalCost({ over: 0, neededPerMonth: null, daysInMonth: 30 });

function status(available: number, spend: number, opts: { fixed?: boolean; c?: typeof ctx | { daysInMonth: number }; neededPerMonth?: number | null } = {}) {
  const r = budgetRunway({ available, spend, isFixedAmount: !!opts.fixed }, opts.c ?? ctx, fmt);
  const cost =
    opts.neededPerMonth != null ? goalCost({ over: Math.max(0, spend - available), neededPerMonth: opts.neededPerMonth, daysInMonth: 30 }) : noGoal;
  return budgetStatus({ available, spend, month }, r, cost, fmt);
}

describe("budgetStatus", () => {
  it("is on track when the money lasts the month", () => {
    expect(status(12000, 3000)).toMatchObject({ tone: "ok", text: "On track · lasts the month", cost: "", spentPct: 0.25 });
  });

  it("is ahead of pace with a run-out date when spending too fast", () => {
    const s = status(40000, 18000);
    expect(s.tone).toBe("ahead");
    expect(s.text).toMatch(/^Ahead of pace · runs out around Nov \d+$/);
  });

  it("is over, and adds the goal cost only when there is one", () => {
    expect(status(20000, 22400)).toMatchObject({ tone: "over", text: "Over by $24", cost: "", spentPct: 1 });
    const priced = status(20000, 22400, { neededPerMonth: 30 * 1800 });
    expect(priced.cost).toBe(" · cost the goal 1.3 days");
  });

  it("settles fixed amounts as paid or not", () => {
    expect(status(180000, 180000, { fixed: true })).toMatchObject({ tone: "settled", text: "Paid", spentPct: 1 });
    expect(status(180000, 0, { fixed: true })).toMatchObject({ tone: "settled", text: "Not paid yet", spentPct: 0 });
  });

  it("has no pace outside the current month", () => {
    expect(status(10000, 4000, { c: { daysInMonth: 30 } })).toMatchObject({ tone: "settled", text: "$40 spent" });
    expect(status(10000, 12000, { c: { daysInMonth: 30 } })).toMatchObject({ tone: "over", text: "Over by $20" });
  });

  it("calls an untouched budget out plainly", () => {
    expect(status(5000, 0)).toMatchObject({ tone: "ok", text: "Nothing spent yet", spentPct: 0 });
  });
});

describe("goalCostSuffix", () => {
  it("prices a pace that hasn't gone over yet", () => {
    expect(goalCostSuffix({ kind: "rate", days: 0, projectedDays: 2.1, label: null, note: "2.1 days at this rate" })).toBe(" · 2.1 days off the goal at this rate");
  });
  it("is empty when nothing is owed", () => {
    expect(goalCostSuffix({ kind: "none", days: 0, projectedDays: null, label: null, note: null })).toBe("");
  });
});
