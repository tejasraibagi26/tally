/**
 * Pure rule matching/resolution (WORK.md §7.2). No DB access here — callers
 * (lib/categorize.ts, the /api/rules preview endpoint) load rows and pass
 * plain objects in, which keeps this testable without Postgres.
 */

export type RuleField = "description" | "merchant" | "amount" | "account" | "pfc_primary" | "pfc_detailed" | "direction";
export type RuleOp = "contains" | "regex" | "equals" | "gte" | "lte" | "between" | "in";

export interface RuleMatch {
  field: RuleField;
  op: RuleOp;
  value: string | number | [number, number] | string[];
}

export interface RuleActions {
  setCategoryId?: string;
  addTag?: string;
  exclude?: boolean;
  markTransfer?: boolean;
  split?: { categoryId: string; amount: number }[];
}

export interface RuleLike {
  id: string;
  priority: number;
  enabled: boolean;
  match: RuleMatch;
  actions: RuleActions;
}

export interface MatchableTransaction {
  name: string;
  merchantName: string | null;
  amount: number; // cents, signed (expenses negative, income positive — §7.3)
  accountId: string;
  pfcPrimary: string | null;
  pfcDetailed: string | null;
}

export function matchesRule(tx: MatchableTransaction, m: RuleMatch): boolean {
  switch (m.field) {
    case "description": {
      const haystack = tx.name.toLowerCase();
      if (m.op === "contains") return haystack.includes(String(m.value).toLowerCase());
      if (m.op === "equals") return haystack === String(m.value).toLowerCase();
      if (m.op === "regex") {
        try {
          return new RegExp(String(m.value), "i").test(tx.name);
        } catch {
          return false;
        }
      }
      return false;
    }
    case "merchant": {
      if (!tx.merchantName) return false;
      const haystack = tx.merchantName.toLowerCase();
      if (m.op === "equals") return haystack === String(m.value).toLowerCase();
      if (m.op === "contains") return haystack.includes(String(m.value).toLowerCase());
      return false;
    }
    case "amount": {
      const abs = Math.abs(tx.amount);
      if (m.op === "gte") return abs >= Number(m.value);
      if (m.op === "lte") return abs <= Number(m.value);
      if (m.op === "between" && Array.isArray(m.value)) {
        const [lo, hi] = m.value as [number, number];
        return abs >= lo && abs <= hi;
      }
      return false;
    }
    case "account": {
      if (m.op === "equals") return tx.accountId === String(m.value);
      if (m.op === "in" && Array.isArray(m.value)) return (m.value as string[]).includes(tx.accountId);
      return false;
    }
    case "pfc_primary":
      return m.op === "equals" && tx.pfcPrimary === m.value;
    case "pfc_detailed":
      return m.op === "equals" && tx.pfcDetailed === m.value;
    case "direction":
      if (m.value === "in") return tx.amount > 0;
      if (m.value === "out") return tx.amount < 0;
      return false;
    default:
      return false;
  }
}

export interface ResolvedActions {
  categoryId?: string;
  matchedRuleId?: string;
  tags: string[];
  exclude?: boolean;
  markTransfer?: boolean;
  split?: { categoryId: string; amount: number }[];
}

/**
 * Applies every enabled rule that matches, in ascending `priority` order
 * (lower number = higher priority = evaluated first). "First match wins per
 * action type" (§7.2): once an earlier rule has set category/exclude/
 * markTransfer/split, a later matching rule can't override it. Tags are the
 * one exception — every matching rule's tag is added, since tagging is
 * additive by nature.
 */
export function resolveRuleActions(tx: MatchableTransaction, rules: RuleLike[]): ResolvedActions {
  const result: ResolvedActions = { tags: [] };
  const sorted = [...rules].filter((r) => r.enabled).sort((a, b) => a.priority - b.priority);

  for (const rule of sorted) {
    if (!matchesRule(tx, rule.match)) continue;
    const a = rule.actions;

    if (a.setCategoryId != null && result.categoryId === undefined) {
      result.categoryId = a.setCategoryId;
      result.matchedRuleId = rule.id;
    }
    if (a.addTag && !result.tags.includes(a.addTag)) result.tags.push(a.addTag);
    if (a.exclude != null && result.exclude === undefined) result.exclude = a.exclude;
    if (a.markTransfer != null && result.markTransfer === undefined) result.markTransfer = a.markTransfer;
    if (a.split && result.split === undefined) result.split = a.split;
  }

  return result;
}

/**
 * What an "Always use … for …" rule made from one transaction should match.
 * The merchant name when Plaid gave one. Otherwise the description, minus
 * the parts that change on every charge: payroll deposits come with no
 * merchant and a fresh reference number each time ("PAYROLL DEP 0012345
 * ACME CORP"), so matching the raw description would never fire again.
 * Tokens holding a digit are dropped and the rest must appear in order
 * (regex, case-insensitive, like every description rule). Null when too
 * little is left to tell one payer from another.
 */
export interface RuleTarget {
  kind: "merchant" | "description";
  /** What the UI names: the merchant, or the description's kept words. */
  label: string;
  match: RuleMatch;
}

const MAX_DESCRIPTION_TOKENS = 6;

export function ruleTargetFor(tx: { merchantName: string | null; name: string }): RuleTarget | null {
  if (tx.merchantName) return { kind: "merchant", label: tx.merchantName, match: { field: "merchant", op: "equals", value: tx.merchantName } };

  const tokens = tx.name
    .split(/\s+/)
    .map((t) => t.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, ""))
    .filter((t) => !/\d/.test(t) && (t.match(/\p{L}/gu) ?? []).length >= 2)
    .slice(0, MAX_DESCRIPTION_TOKENS);
  if (tokens.join("").length < 4) return null;

  const escape = (t: string) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return { kind: "description", label: tokens.join(" "), match: { field: "description", op: "regex", value: tokens.map(escape).join(".*") } };
}
