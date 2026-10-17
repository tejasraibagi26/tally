import { and, eq, inArray, isNotNull, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { merchantRenameKey, resolveMerchantName } from "@tally/core/merchantName";
import type { RuleMatch } from "@tally/core/rulesEngine";

/** The user's renames, by merchantRenameKey() of the name they replace. */
export async function loadMerchantRenames(userId: string): Promise<Map<string, string>> {
  const rows = await db
    .select({ sourceKey: schema.merchantRenames.sourceKey, displayName: schema.merchantRenames.displayName })
    .from(schema.merchantRenames)
    .where(eq(schema.merchantRenames.userId, userId));
  return new Map(rows.map((r) => [r.sourceKey, r.displayName]));
}

/**
 * The merchant name to store: the user's rename if they made one, else
 * `merchantName`. A transaction with no merchant shows its description, so
 * that's what its rename is keyed by.
 */
export function applyMerchantRename(renames: Map<string, string>, merchantName: string | null, description: string): string | null {
  const key = merchantRenameKey(merchantName ?? description);
  return (key && renames.get(key)) ?? merchantName;
}

/**
 * The name a synced transaction shows before any rename -- what a rename is
 * keyed by. Rebuilt from Plaid's original merchant_name (kept in `raw`), so
 * it's stable however many times the row has been renamed.
 */
export function originalMerchantName(row: { name: string; plaidMerchantName: string | null }): string | null {
  return resolveMerchantName(row.plaidMerchantName, row.name);
}

const plaidMerchantNameSql = sql<string | null>`${schema.transactions.raw}->>'merchant_name'`;

/** This transaction's merchant before any rename, and the user's rename of it; null for a non-synced row. */
export async function getMerchantRename(userId: string, transactionId: string): Promise<{ original: string; displayName: string | null } | null> {
  const [row] = await db
    .select({ name: schema.transactions.name, plaidMerchantName: plaidMerchantNameSql })
    .from(schema.transactions)
    .where(and(eq(schema.transactions.id, transactionId), eq(schema.transactions.userId, userId), isNotNull(schema.transactions.raw)))
    .limit(1);
  if (!row) return null;
  const original = originalMerchantName(row) ?? row.name;
  const renames = await loadMerchantRenames(userId);
  return { original, displayName: renames.get(merchantRenameKey(original)!) ?? null };
}

/**
 * Sets (or with a null/blank/unchanged name, removes) the user's name for
 * this transaction's merchant, then rewrites every matching transaction.
 * Returns the merchant's original name and how many transactions it covers.
 */
export async function setMerchantRename(
  userId: string,
  transactionId: string,
  displayName: string | null,
): Promise<{ original: string; displayName: string; count: number } | null> {
  const [row] = await db
    .select({ name: schema.transactions.name, plaidMerchantName: plaidMerchantNameSql })
    .from(schema.transactions)
    .where(and(eq(schema.transactions.id, transactionId), eq(schema.transactions.userId, userId), isNotNull(schema.transactions.raw)))
    .limit(1);
  if (!row) return null;
  const original = originalMerchantName(row) ?? row.name;
  const sourceKey = merchantRenameKey(original)!;

  const next = displayName?.trim().replace(/\s+/g, " ") ?? "";
  if (!next || merchantRenameKey(next) === sourceKey) {
    await db.delete(schema.merchantRenames).where(and(eq(schema.merchantRenames.userId, userId), eq(schema.merchantRenames.sourceKey, sourceKey)));
  } else {
    await db
      .insert(schema.merchantRenames)
      .values({ userId, sourceKey, displayName: next })
      .onConflictDoUpdate({ target: [schema.merchantRenames.userId, schema.merchantRenames.sourceKey], set: { displayName: next } });
  }

  const count = await refreshMerchantNames(userId, sourceKey);
  return { original, displayName: next || original, count };
}

/**
 * Re-derives merchant_name on the user's synced transactions from Plaid's
 * original merchant name, resolveMerchantName() and their renames -- all of
 * them, or only those whose original name has `onlySourceKey`. A
 * merchant-equals rule pointing at a name that changed is retargeted to the
 * new one, so "Always use Insurance for Child Net" keeps working once the
 * merchant shows as "Sonnet Insurance". Returns how many rows matched.
 */
export async function refreshMerchantNames(userId: string, onlySourceKey?: string): Promise<number> {
  const renames = await loadMerchantRenames(userId);
  const rows = await db
    .select({
      id: schema.transactions.id,
      name: schema.transactions.name,
      merchantName: schema.transactions.merchantName,
      plaidMerchantName: plaidMerchantNameSql,
    })
    .from(schema.transactions)
    .where(and(eq(schema.transactions.userId, userId), isNotNull(schema.transactions.raw)));

  let matched = 0;
  const idsByName = new Map<string | null, string[]>(); // new name -> ids
  const overruledIds: string[] = [];
  const renamedTo = new Map<string, Set<string>>(); // old name (lowercased) -> new names
  const kept = new Set<string>(); // names (lowercased) some row keeps
  for (const r of rows) {
    const original = originalMerchantName(r);
    if (onlySourceKey !== undefined && merchantRenameKey(original ?? r.name) !== onlySourceKey) continue;
    matched++;
    const next = applyMerchantRename(renames, original, r.name);
    if (original !== (r.plaidMerchantName?.trim() || null)) overruledIds.push(r.id);
    if (next === r.merchantName) {
      if (r.merchantName) kept.add(r.merchantName.toLowerCase());
      continue;
    }
    const ids = idsByName.get(next) ?? [];
    ids.push(r.id);
    idsByName.set(next, ids);
    if (r.merchantName && next) {
      const old = r.merchantName.toLowerCase();
      renamedTo.set(old, (renamedTo.get(old) ?? new Set()).add(next));
    }
  }

  for (const [name, ids] of idsByName) {
    for (let i = 0; i < ids.length; i += 500) {
      await db.update(schema.transactions).set({ merchantName: name }).where(inArray(schema.transactions.id, ids.slice(i, i + 500)));
    }
  }
  // Plaid's logo and counterparties belong to the merchant it wrongly matched (see toPlaidOwnedFields).
  for (let i = 0; i < overruledIds.length; i += 500) {
    await db
      .update(schema.transactions)
      .set({ logoUrl: null, website: null, counterparties: null, merchantEntityId: null })
      .where(inArray(schema.transactions.id, overruledIds.slice(i, i + 500)));
  }

  if (renamedTo.size > 0) {
    const rules = await db.select({ id: schema.rules.id, match: schema.rules.match }).from(schema.rules).where(eq(schema.rules.userId, userId));
    for (const rule of rules) {
      const m = rule.match as RuleMatch;
      if (m.field !== "merchant" || m.op !== "equals" || typeof m.value !== "string") continue;
      const old = m.value.toLowerCase();
      const targets = renamedTo.get(old);
      // Only when every row of the old name moved to one new name -- otherwise the rule's intent is ambiguous.
      if (targets?.size !== 1 || kept.has(old)) continue;
      await db.update(schema.rules).set({ match: { ...m, value: [...targets][0] } }).where(eq(schema.rules.id, rule.id));
    }
  }
  return matched;
}
