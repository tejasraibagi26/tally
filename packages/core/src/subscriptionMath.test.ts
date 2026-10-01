import { describe, expect, it } from "vitest";
import { monthlyCost, subscriptionsMonthlyTotal, type StreamCostInput } from "./subscriptionMath";

const s = (extra: Partial<StreamCostInput> = {}): StreamCostInput => ({
  averageAmount: -1_199,
  frequency: "monthly",
  status: "active",
  manualNextDueDate: null,
  isManual: false,
  amortizeMonthly: false,
  amortizeMonths: 12,
  ...extra,
});

describe("subscriptionMath", () => {
  it("scales by frequency", () => {
    expect(monthlyCost(s({ averageAmount: -12_000, frequency: "annual" }))).toBe(1_000);
    expect(monthlyCost(s({ averageAmount: -3_000, frequency: "quarterly" }))).toBe(1_000);
  });
  it("a spread plan costs the charge over its term, whatever the detected frequency", () => {
    // $6,000 rent prepaid for 6 months, detected as "monthly": $1,000/mo, not $6,000.
    expect(monthlyCost(s({ averageAmount: -600_000, frequency: "monthly", amortizeMonthly: true, amortizeMonths: 6 }))).toBe(100_000);
  });
  it("skips income and cancelled streams, but keeps a cancelled one with a manual due date", () => {
    const out = subscriptionsMonthlyTotal([
      s(),
      s({ averageAmount: 250_000 }),
      s({ status: "cancelled" }),
      s({ status: "cancelled", manualNextDueDate: "2026-11-01" }),
    ]);
    expect(out).toEqual({ activeCount: 2, monthlyTotal: 2_398 });
  });
  it("leaves out bills added by hand, like rent", () => {
    const out = subscriptionsMonthlyTotal([s(), s({ averageAmount: -215_000, isManual: true, manualNextDueDate: "2026-11-01" })]);
    expect(out).toEqual({ activeCount: 1, monthlyTotal: 1_199 });
  });
});
