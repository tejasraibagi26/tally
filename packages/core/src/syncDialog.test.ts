import { describe, expect, it } from "vitest";
import { connectErrorCopy, syncDialogCopy, syncSteps } from "./syncDialog";

describe("syncSteps", () => {
  it("builds rows from the picked account types, all pending while running", () => {
    const rows = syncSteps(["depository", "depository", "credit"], null);
    expect(rows.map((r) => r.key)).toEqual(["accounts", "transactions", "credit"]);
    expect(rows.every((r) => r.status === "pending")).toBe(true);
    expect(rows[0]!.detail).toBe("3 accounts");
  });

  it("adds investments only when an investment account was picked", () => {
    expect(syncSteps(["investment"], null).map((r) => r.key)).toEqual(["accounts", "investments"]);
  });

  it("falls back to accounts + transactions when Link gave no account types", () => {
    const rows = syncSteps([], null);
    expect(rows.map((r) => r.key)).toEqual(["accounts", "transactions"]);
    expect(rows[0]!.detail).toBeNull();
  });

  it("marks failed products and adds a row for a failure it didn't expect", () => {
    const rows = syncSteps(["depository"], [{ product: "liabilities" }]);
    expect(rows.map((r) => [r.key, r.status])).toEqual([
      ["accounts", "done"],
      ["transactions", "done"],
      ["credit", "failed"],
    ]);
  });
});

describe("syncDialogCopy", () => {
  it("names the bank and the gap count on a partial connect", () => {
    const copy = syncDialogCopy({ mode: "create", phase: "partial", institutionName: "TD Canada Trust", accountCount: 4, failureLabels: ["credit card details"] });
    expect(copy.title).toBe("Connected, with one gap");
    expect(copy.subtitle).toBe("TD Canada Trust · 4 accounts");
    expect(copy.body).toContain("didn't send credit card details");
  });

  it("uses reconnect wording in update mode", () => {
    expect(syncDialogCopy({ mode: "update", phase: "syncing", institutionName: "RBC", accountCount: 0 }).title).toBe("Reconnecting RBC");
    expect(syncDialogCopy({ mode: "update", phase: "failed", institutionName: "RBC", accountCount: 0 }).title).toBe("Couldn't refresh RBC");
  });

  it("falls back to 'your bank' when Plaid sent no name", () => {
    expect(syncDialogCopy({ mode: "create", phase: "syncing", institutionName: null, accountCount: 0 }).title).toBe("Connecting your bank");
  });
});

describe("connectErrorCopy", () => {
  it("never shows the raw code", () => {
    const copy = connectErrorCopy("INSTITUTION_NOT_RESPONDING", "TD");
    expect(copy.subtitle).toBe("TD isn't responding right now");
    expect(JSON.stringify(copy)).not.toContain("INSTITUTION");
  });

  it("doesn't claim the user signed in when Link itself failed", () => {
    expect(connectErrorCopy(null, "TD", "link").body).not.toContain("signed in");
  });

  it("has a generic fallback", () => {
    expect(connectErrorCopy("SOMETHING_NEW", "TD").subtitle).toBe("Something went wrong");
  });
});
