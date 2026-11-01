import { describe, it, expect } from "vitest";
import { duplicatesBill, loanPayments, loanPaymentsBesideBills, type LoanInput } from "./loans";

const mortgage: LoanInput = { accountId: "m1", label: "Mortgage", payment: 180_000, dueDate: "2026-11-15", dueDay: null };

describe("loanPayments", () => {
  it("lists the lender's date, then one modelled payment a month", () => {
    const p = loanPayments(mortgage, "2026-11-01", "2026-10-29", "2027-01-30");
    expect(p.map((x) => [x.date, x.modelled])).toEqual([
      ["2026-11-15", false],
      ["2026-12-15", true],
      ["2027-01-15", true],
    ]);
    expect(p.every((x) => x.amount === 180_000)).toBe(true);
  });

  it("rolls a stale lender date forward instead of charging it again today", () => {
    const p = loanPayments({ ...mortgage, dueDate: "2026-09-15" }, "2026-11-01", "2026-10-29", "2026-11-30");
    expect(p.map((x) => x.date)).toEqual(["2026-11-15"]);
  });

  it("keeps a payment a day or two past due (the grace window)", () => {
    const p = loanPayments({ ...mortgage, dueDate: "2026-10-30" }, "2026-11-01", "2026-10-29", "2026-11-10");
    expect(p.map((x) => x.date)).toEqual(["2026-10-30"]);
  });

  it("clamps to the month's last day without drifting", () => {
    const p = loanPayments({ ...mortgage, dueDate: "2027-01-31" }, "2027-01-20", "2027-01-17", "2027-03-31");
    expect(p.map((x) => x.date)).toEqual(["2027-01-31", "2027-02-28", "2027-03-31"]);
  });

  it("uses the user's due day when the lender gives no date", () => {
    const p = loanPayments({ ...mortgage, dueDate: null, dueDay: 5 }, "2026-11-01", "2026-10-29", "2026-11-30");
    expect(p).toEqual([{ accountId: "m1", label: "Mortgage", amount: 180_000, date: "2026-11-05", modelled: true }]);
  });

  it("adds nothing without a payment amount or a date", () => {
    expect(loanPayments({ ...mortgage, payment: null }, "2026-11-01", "2026-10-29", "2026-12-31")).toEqual([]);
    expect(loanPayments({ ...mortgage, dueDate: null }, "2026-11-01", "2026-10-29", "2026-12-31")).toEqual([]);
  });
});

describe("duplicatesBill", () => {
  it("matches a detected bill close in amount and date", () => {
    expect(duplicatesBill({ amount: 180_000, date: "2026-11-15" }, [{ amount: -181_000, date: "2026-11-13" }])).toBe(true);
  });
  it("ignores a bill far off in amount or date", () => {
    expect(duplicatesBill({ amount: 180_000, date: "2026-11-15" }, [{ amount: -120_000, date: "2026-11-15" }])).toBe(false);
    expect(duplicatesBill({ amount: 180_000, date: "2026-11-15" }, [{ amount: -180_000, date: "2026-11-30" }])).toBe(false);
  });
});

describe("loanPaymentsBesideBills", () => {
  it("drops a loan a detected bill already stands for, keeps the rest", () => {
    const student: LoanInput = { accountId: "s1", label: "Student loan", payment: 25_000, dueDate: "2026-11-20", dueDay: null };
    const p = loanPaymentsBesideBills([mortgage, student], [{ amount: -180_000, date: "2026-11-14" }], "2026-11-01", "2026-10-29", "2026-11-30");
    expect(p.map((x) => x.accountId)).toEqual(["s1"]);
  });
});
