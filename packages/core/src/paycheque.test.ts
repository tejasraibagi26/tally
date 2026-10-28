import { describe, it, expect } from "vitest";
import { detectPaycheques, primaryPaycheque, type IncomeDeposit } from "./paycheque";

let n = 0;
function dep(date: string, amount = 240000, name = "PAYROLL DEP 00123 ACME CORP"): IncomeDeposit {
  return { id: `d${n++}`, accountId: "chq", merchantName: null, name: name.replace("00123", String(1000 + n)), amount, date };
}

describe("detectPaycheques", () => {
  it("finds a biweekly paycheque whose reference number and amount move", () => {
    const found = detectPaycheques([dep("2026-09-04", 240000), dep("2026-09-18", 245000), dep("2026-10-02", 238000), dep("2026-10-16", 251000)], "2026-10-28");
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ cadence: "biweekly", nextDate: "2026-10-30", confident: true, label: "PAYROLL DEP ACME CORP" });
    expect(found[0]!.amount).toBe(245000);
  });

  it("leaves a one-off bonus out of the run", () => {
    const found = detectPaycheques([dep("2026-09-04"), dep("2026-09-18"), dep("2026-09-25", 900000), dep("2026-10-02"), dep("2026-10-16")], "2026-10-28");
    expect(found[0]).toMatchObject({ cadence: "biweekly", nextDate: "2026-10-30" });
    expect(found[0]!.depositIds).toHaveLength(4);
  });

  it("predicts semi-monthly pay from its anchors, weekend-shifted", () => {
    const found = detectPaycheques([dep("2026-08-14"), dep("2026-08-31"), dep("2026-09-15"), dep("2026-09-30"), dep("2026-10-15")], "2026-10-28");
    expect(found[0]).toMatchObject({ cadence: "semimonthly", nextDate: "2026-10-30", confident: true });
  });

  it("predicts monthly pay on its usual day", () => {
    const found = detectPaycheques([dep("2026-07-24"), dep("2026-08-25"), dep("2026-09-25"), dep("2026-10-23")], "2026-10-28");
    expect(found[0]).toMatchObject({ cadence: "monthly", nextDate: "2026-11-25", confident: true });
  });

  it("needs three deposits", () => {
    expect(detectPaycheques([dep("2026-10-02"), dep("2026-10-16")], "2026-10-28")).toHaveLength(0);
  });

  it("ignores an irregular payer", () => {
    expect(detectPaycheques([dep("2026-08-03"), dep("2026-08-29"), dep("2026-09-07"), dep("2026-10-20")], "2026-10-28")).toHaveLength(0);
  });

  it("isn't confident once a paycheque is overdue", () => {
    const found = detectPaycheques([dep("2026-08-21"), dep("2026-09-04"), dep("2026-09-18")], "2026-10-28");
    expect(found[0]!.confident).toBe(false);
    expect(primaryPaycheque(found)).toBeNull();
  });

  it("puts the bigger paycheque first", () => {
    const small = ["2026-09-04", "2026-09-18", "2026-10-02", "2026-10-16"].map((d) => dep(d, 50000, "SIDE GIG 00123 PAYOUT"));
    const big = ["2026-09-04", "2026-09-18", "2026-10-02", "2026-10-16"].map((d) => dep(d, 300000));
    expect(primaryPaycheque(detectPaycheques([...small, ...big], "2026-10-28"))!.amount).toBe(300000);
  });
});
