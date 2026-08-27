import { describe, it, expect } from "vitest";
import { matchesRule, resolveRuleActions, type MatchableTransaction, type RuleLike } from "./rulesEngine";

function tx(overrides: Partial<MatchableTransaction> = {}): MatchableTransaction {
  return {
    name: "STARBUCKS #4821",
    merchantName: "Starbucks",
    amount: -650,
    accountId: "acct_checking",
    pfcPrimary: "FOOD_AND_DRINK",
    pfcDetailed: "FOOD_AND_DRINK_COFFEE",
    ...overrides,
  };
}

function rule(overrides: Partial<RuleLike> = {}): RuleLike {
  return {
    id: "rule_1",
    priority: 0,
    enabled: true,
    match: { field: "merchant", op: "equals", value: "Starbucks" },
    actions: {},
    ...overrides,
  };
}

describe("matchesRule", () => {
  it("matches merchant equals case-insensitively", () => {
    expect(matchesRule(tx(), { field: "merchant", op: "equals", value: "starbucks" })).toBe(true);
  });

  it("does not match merchant equals against a substring", () => {
    expect(matchesRule(tx(), { field: "merchant", op: "equals", value: "Star" })).toBe(false);
  });

  it("matches description contains", () => {
    expect(matchesRule(tx(), { field: "description", op: "contains", value: "starbucks" })).toBe(true);
  });

  it("matches description regex", () => {
    expect(matchesRule(tx(), { field: "description", op: "regex", value: "^STARBUCKS #\\d+$" })).toBe(true);
  });

  it("treats an invalid regex as a non-match rather than throwing", () => {
    expect(matchesRule(tx(), { field: "description", op: "regex", value: "(" })).toBe(false);
  });

  it("matches amount by absolute value regardless of sign", () => {
    expect(matchesRule(tx({ amount: -650 }), { field: "amount", op: "gte", value: 500 })).toBe(true);
    expect(matchesRule(tx({ amount: 650 }), { field: "amount", op: "gte", value: 500 })).toBe(true);
  });

  it("matches amount between an inclusive range", () => {
    expect(matchesRule(tx({ amount: -650 }), { field: "amount", op: "between", value: [600, 700] })).toBe(true);
    expect(matchesRule(tx({ amount: -650 }), { field: "amount", op: "between", value: [0, 100] })).toBe(false);
  });

  it("matches account equals and in", () => {
    expect(matchesRule(tx(), { field: "account", op: "equals", value: "acct_checking" })).toBe(true);
    expect(matchesRule(tx(), { field: "account", op: "in", value: ["acct_savings", "acct_checking"] })).toBe(true);
    expect(matchesRule(tx(), { field: "account", op: "in", value: ["acct_savings"] })).toBe(false);
  });

  it("matches direction by sign per the internal convention (expenses negative, income positive)", () => {
    expect(matchesRule(tx({ amount: -100 }), { field: "direction", op: "equals", value: "out" })).toBe(true);
    expect(matchesRule(tx({ amount: 100 }), { field: "direction", op: "equals", value: "in" })).toBe(true);
    expect(matchesRule(tx({ amount: 100 }), { field: "direction", op: "equals", value: "out" })).toBe(false);
  });

  it("matches pfc primary/detailed equals", () => {
    expect(matchesRule(tx(), { field: "pfc_detailed", op: "equals", value: "FOOD_AND_DRINK_COFFEE" })).toBe(true);
    expect(matchesRule(tx(), { field: "pfc_primary", op: "equals", value: "TRAVEL" })).toBe(false);
  });

  it("never matches merchant when the transaction has no merchant name", () => {
    expect(matchesRule(tx({ merchantName: null }), { field: "merchant", op: "contains", value: "star" })).toBe(false);
  });
});

describe("resolveRuleActions", () => {
  it("applies a single matching rule's category", () => {
    const r = rule({ actions: { setCategoryId: "cat_coffee" } });
    const result = resolveRuleActions(tx(), [r]);
    expect(result.categoryId).toBe("cat_coffee");
    expect(result.matchedRuleId).toBe("rule_1");
  });

  it("skips a disabled rule", () => {
    const r = rule({ enabled: false, actions: { setCategoryId: "cat_coffee" } });
    expect(resolveRuleActions(tx(), [r]).categoryId).toBeUndefined();
  });

  it("first match wins per action type: lower priority number runs first and its category sticks", () => {
    const high = rule({ id: "r_high", priority: 0, actions: { setCategoryId: "cat_a" } });
    const low = rule({ id: "r_low", priority: 10, actions: { setCategoryId: "cat_b" } });
    // Order in the input array shouldn't matter — resolution sorts by priority.
    expect(resolveRuleActions(tx(), [low, high]).categoryId).toBe("cat_a");
    expect(resolveRuleActions(tx(), [high, low]).categoryId).toBe("cat_a");
  });

  it("lets a lower-priority rule fill in an action type an earlier rule didn't set", () => {
    const categorize = rule({ id: "r1", priority: 0, actions: { setCategoryId: "cat_a" } });
    const exclude = rule({ id: "r2", priority: 10, actions: { exclude: true } });
    const result = resolveRuleActions(tx(), [categorize, exclude]);
    expect(result.categoryId).toBe("cat_a");
    expect(result.exclude).toBe(true);
  });

  it("accumulates tags from every matching rule instead of first-wins", () => {
    const r1 = rule({ id: "r1", priority: 0, actions: { addTag: "coffee" } });
    const r2 = rule({ id: "r2", priority: 10, actions: { addTag: "daily" } });
    expect(resolveRuleActions(tx(), [r1, r2]).tags).toEqual(["coffee", "daily"]);
  });

  it("dedupes a tag added by more than one matching rule", () => {
    const r1 = rule({ id: "r1", priority: 0, actions: { addTag: "coffee" } });
    const r2 = rule({ id: "r2", priority: 10, actions: { addTag: "coffee" } });
    expect(resolveRuleActions(tx(), [r1, r2]).tags).toEqual(["coffee"]);
  });

  it("ignores a non-matching rule entirely", () => {
    const r = rule({ match: { field: "merchant", op: "equals", value: "Not Starbucks" }, actions: { setCategoryId: "cat_a" } });
    expect(resolveRuleActions(tx(), [r]).categoryId).toBeUndefined();
  });
});
