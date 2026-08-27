import type { RuleActions, RuleMatch } from "@tally/core/rulesEngine";

const FIELD_LABEL: Record<string, string> = {
  description: "description",
  merchant: "merchant",
  amount: "amount",
  account: "account",
  pfc_primary: "Plaid category",
  pfc_detailed: "Plaid subcategory",
  direction: "direction",
};

const OP_LABEL: Record<string, string> = {
  contains: "contains",
  regex: "matches",
  equals: "is",
  gte: "≥",
  lte: "≤",
  between: "between",
  in: "is one of",
};

export function summarizeMatch(match: RuleMatch, lookups: { accountName?: (id: string) => string | undefined } = {}): string {
  const field = FIELD_LABEL[match.field] ?? match.field;
  const op = OP_LABEL[match.op] ?? match.op;

  if (match.field === "amount") {
    const cents = typeof match.value === "number" ? match.value : 0;
    return `When ${field} ${op} $${(cents / 100).toFixed(2)}`;
  }
  if (match.field === "account" && typeof match.value === "string") {
    return `When ${field} ${op} ${lookups.accountName?.(match.value) ?? match.value}`;
  }
  return `When ${field} ${op} "${String(match.value)}"`;
}

export function summarizeActions(actions: RuleActions, categoryName?: (id: string) => string | undefined): string {
  const parts: string[] = [];
  if (actions.setCategoryId) parts.push(`set category to ${categoryName?.(actions.setCategoryId) ?? "…"}`);
  if (actions.addTag) parts.push(`add tag "${actions.addTag}"`);
  if (actions.exclude) parts.push("exclude from budget");
  if (actions.markTransfer) parts.push("mark as transfer");
  if (actions.split?.length) parts.push(`split ${actions.split.length} ways`);
  return parts.length > 0 ? parts.join(", ") : "no actions";
}
