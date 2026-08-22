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
