import { and, eq, inArray, isNull, ne } from "drizzle-orm";
import { db, schema } from "@/db";
import { categorySlugForPfc } from "@/lib/categoryTaxonomy";
import { matchesRule, resolveRuleActions, type MatchableTransaction, type RuleActions, type RuleLike, type RuleMatch } from "@/lib/rulesEngine";

/**
 * Default-categorizes and rule-categorizes a batch of transactions
 * (WORK.md §7.1, §7.2). Called from lib/plaidSync.ts right after a sync
 * reconciles added/modified rows, and from the rules API for "apply to
 * existing transactions".
 *
 * By default only touches rows still `category_source = 'plaid'` — once a
 * rule or a human has claimed a transaction, this skips it (mirrors the
 * guard in mapPlaidTransaction.mergeTransactionUpdate). Pass
 * `includeRuleSourced: true` for an explicit "apply to existing" run, which
 * also re-arbitrates rows a *rule* previously claimed (rule priorities may
 * have just changed) — never rows a human categorized manually.
 */
export async function categorizeTransactions(
  userId: string,
  transactionIds: string[],
  options: { includeRuleSourced?: boolean } = {},
): Promise<void> {
  if (transactionIds.length === 0) return;

  const sourceFilter = options.includeRuleSourced
    ? ne(schema.transactions.categorySource, "manual")
    : eq(schema.transactions.categorySource, "plaid");

  const rows = await db
    .select({
      id: schema.transactions.id,
      name: schema.transactions.name,
      merchantName: schema.transactions.merchantName,
      amount: schema.transactions.amount,
      accountId: schema.transactions.accountId,
      pfcPrimary: schema.transactions.pfcPrimary,
      pfcDetailed: schema.transactions.pfcDetailed,
      tags: schema.transactions.tags,
    })
    .from(schema.transactions)
    .where(and(inArray(schema.transactions.id, transactionIds), sourceFilter));
  if (rows.length === 0) return;

  const defaultCategoryByPfcSlug = await loadSystemCategoryIdsBySlug();
  const rules = await loadUserRules(userId);
  const splitTargetIds = rules.length ? await transactionsWithExistingSplits(rows.map((r) => r.id)) : new Set<string>();

  for (const row of rows) {
    const tx: MatchableTransaction = {
      name: row.name,
      merchantName: row.merchantName,
      amount: row.amount,
      accountId: row.accountId,
      pfcPrimary: row.pfcPrimary,
      pfcDetailed: row.pfcDetailed,
    };

    const resolved = resolveRuleActions(tx, rules);
    const defaultCategoryId = defaultCategoryByPfcSlug.get(categorySlugForPfc(row.pfcDetailed) ?? "") ?? null;

    const update: Partial<typeof schema.transactions.$inferInsert> = {};

    if (resolved.categoryId) {
      update.categoryId = resolved.categoryId;
      update.categorySource = "rule";
    } else if (defaultCategoryId) {
      update.categoryId = defaultCategoryId;
      // categorySource stays "plaid" — this is the taxonomy default, not a rule decision.
    }
    if (resolved.tags.length > 0) {
      update.tags = Array.from(new Set([...(row.tags ?? []), ...resolved.tags]));
    }
    if (resolved.exclude != null) update.excludedFromBudget = resolved.exclude;
    if (resolved.markTransfer != null) update.isTransfer = resolved.markTransfer;

    if (Object.keys(update).length > 0) {
      await db.update(schema.transactions).set(update).where(eq(schema.transactions.id, row.id));
    }

    if (resolved.split && resolved.split.length > 0 && !splitTargetIds.has(row.id)) {
      await db.insert(schema.transactionSplits).values(
        resolved.split.map((s) => ({ transactionId: row.id, categoryId: s.categoryId, amount: s.amount })),
      );
    }
  }
}

async function loadSystemCategoryIdsBySlug(): Promise<Map<string, string>> {
  const rows = await db
    .select({ id: schema.categories.id, slug: schema.categories.slug })
    .from(schema.categories)
    .where(isNull(schema.categories.userId));
  return new Map(rows.map((r) => [r.slug, r.id]));
}

async function loadUserRules(userId: string): Promise<RuleLike[]> {
  const rows = await db
    .select({
      id: schema.rules.id,
      priority: schema.rules.priority,
      enabled: schema.rules.enabled,
      match: schema.rules.match,
      actions: schema.rules.actions,
    })
    .from(schema.rules)
    .where(eq(schema.rules.userId, userId));
  return rows.map((r) => ({
    id: r.id,
    priority: r.priority,
    enabled: r.enabled,
    match: r.match as RuleMatch,
    actions: r.actions as RuleActions,
  }));
}

async function transactionsWithExistingSplits(transactionIds: string[]): Promise<Set<string>> {
  const rows = await db
    .select({ transactionId: schema.transactionSplits.transactionId })
    .from(schema.transactionSplits)
    .where(inArray(schema.transactionSplits.transactionId, transactionIds));
  return new Set(rows.map((r) => r.transactionId));
}

/** Transactions a rule is allowed to touch: never `manual`, and only `rule`-sourced too when re-arbitrating. */
async function eligibleTransactions(
  userId: string,
  includeRuleSourced: boolean,
): Promise<MatchableTransaction[]> {
  const sourceFilter = includeRuleSourced
    ? ne(schema.transactions.categorySource, "manual")
    : eq(schema.transactions.categorySource, "plaid");

  return db
    .select({
      name: schema.transactions.name,
      merchantName: schema.transactions.merchantName,
      amount: schema.transactions.amount,
      accountId: schema.transactions.accountId,
      pfcPrimary: schema.transactions.pfcPrimary,
      pfcDetailed: schema.transactions.pfcDetailed,
    })
    .from(schema.transactions)
    .where(and(eq(schema.transactions.userId, userId), sourceFilter));
}

/** How many of the user's existing eligible transactions this match would hit — shown before a rule is saved (§7.2). */
export async function previewRuleMatchCount(userId: string, match: RuleMatch): Promise<number> {
  const rows = await eligibleTransactions(userId, true);
  return rows.filter((tx) => matchesRule(tx, match)).length;
}

/** Re-runs the full rules engine over every eligible existing transaction — the "apply to existing" commit. */
export async function applyRulesToExistingTransactions(userId: string): Promise<void> {
  const ids = await db
    .select({ id: schema.transactions.id })
    .from(schema.transactions)
    .where(and(eq(schema.transactions.userId, userId), ne(schema.transactions.categorySource, "manual")));
  await categorizeTransactions(userId, ids.map((r) => r.id), { includeRuleSourced: true });
}
