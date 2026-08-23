import { and, eq, gte, isNull, lt, or, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { monthRange, shiftMonth, computeRemaining } from "@/lib/budgetMath";

export { monthRange, shiftMonth, computeRemaining };

/**
 * Maps every category (system + this user's custom ones) to itself plus all
 * of its descendants — so a budget set on a parent (e.g. "Rent and
 * utilities") can roll up spend tagged to its children ("Internet and
 * cable", "Telephone", ...) without requiring a separate budget per child.
 */
async function categoryRollupMap(userId: string): Promise<Map<string, string[]>> {
  const cats = await db
    .select({ id: schema.categories.id, parentId: schema.categories.parentId })
    .from(schema.categories)
    .where(or(isNull(schema.categories.userId), eq(schema.categories.userId, userId)));

  const childrenByParent = new Map<string, string[]>();
  for (const c of cats) {
    if (!c.parentId) continue;
    childrenByParent.set(c.parentId, [...(childrenByParent.get(c.parentId) ?? []), c.id]);
  }

  const rollup = new Map<string, string[]>();
  function collect(id: string): string[] {
    const cached = rollup.get(id);
    if (cached) return cached;
    const all = [id, ...(childrenByParent.get(id) ?? []).flatMap(collect)];
    rollup.set(id, all);
    return all;
  }
  for (const c of cats) collect(c.id);
  return rollup;
}

function rolledUpSpend(spend: Map<string, number>, rollup: Map<string, string[]>, categoryId: string): number {
  const ids = rollup.get(categoryId) ?? [categoryId];
  return ids.reduce((sum, id) => sum + (spend.get(id) ?? 0), 0);
}

/** Σ |amount| for non-transfer, non-excluded transactions, per category, for one month. */
export async function spendByCategory(userId: string, month: string): Promise<Map<string, number>> {
  const { start, end } = monthRange(month);
  const rows = await db
    .select({
      categoryId: schema.transactions.categoryId,
      total: sql<number>`coalesce(sum(abs(${schema.transactions.amount})), 0)::int`,
    })
    .from(schema.transactions)
    .where(
      and(
        eq(schema.transactions.userId, userId),
        eq(schema.transactions.isTransfer, false),
        eq(schema.transactions.excludedFromBudget, false),
        gte(schema.transactions.postedDate, start),
        lt(schema.transactions.postedDate, end),
      ),
    )
    .groupBy(schema.transactions.categoryId);

  const map = new Map<string, number>();
  for (const row of rows) {
    if (row.categoryId) map.set(row.categoryId, row.total);
  }
  return map;
}

export interface BudgetLine {
  categoryId: string;
  categoryName: string;
  categoryColorSlot: number;
  amount: number;
  rolloverEnabled: boolean;
  rolloverFromPrior: number;
  spend: number;
  remaining: number;
}

/**
 * Rollover is computed on read rather than stored/cron-maintained: walks
 * back to the immediately preceding month's budget for the same category,
 * recursively, as long as rollover stays enabled. Only a *positive* leftover
 * carries forward — an overspent month doesn't compound into next month's
 * required spend. (WORK.md doesn't pin this down explicitly; documented
 * here as the deliberate choice, easy to flip if that's wrong.)
 */
async function priorMonthRollover(userId: string, categoryId: string, month: string, rollup: Map<string, string[]>): Promise<number> {
  const priorMonth = shiftMonth(month, -1);
  const [prior] = await db
    .select()
    .from(schema.budgets)
    .where(and(eq(schema.budgets.userId, userId), eq(schema.budgets.categoryId, categoryId), eq(schema.budgets.month, priorMonth)))
    .limit(1);
  if (!prior) return 0;

  const priorRollover = prior.rolloverEnabled ? await priorMonthRollover(userId, categoryId, priorMonth, rollup) : 0;
  const priorSpend = rolledUpSpend(await spendByCategory(userId, priorMonth), rollup, categoryId);
  const priorRemaining = computeRemaining(prior.amount, priorRollover, priorSpend);
  return Math.max(0, priorRemaining);
}

export async function getBudgetsForMonth(userId: string, month: string): Promise<BudgetLine[]> {
  const rows = await db
    .select({
      categoryId: schema.budgets.categoryId,
      amount: schema.budgets.amount,
      rolloverEnabled: schema.budgets.rolloverEnabled,
      categoryName: schema.categories.name,
      categoryColorSlot: schema.categories.colorSlot,
    })
    .from(schema.budgets)
    .innerJoin(schema.categories, eq(schema.budgets.categoryId, schema.categories.id))
    .where(and(eq(schema.budgets.userId, userId), eq(schema.budgets.month, month)));

  const [spend, rollup] = await Promise.all([spendByCategory(userId, month), categoryRollupMap(userId)]);

  const lines: BudgetLine[] = [];
  for (const row of rows) {
    const rolloverFromPrior = row.rolloverEnabled ? await priorMonthRollover(userId, row.categoryId, month, rollup) : 0;
    const catSpend = rolledUpSpend(spend, rollup, row.categoryId);
    lines.push({
      categoryId: row.categoryId,
      categoryName: row.categoryName,
      categoryColorSlot: row.categoryColorSlot,
      amount: row.amount,
      rolloverEnabled: row.rolloverEnabled,
      rolloverFromPrior,
      spend: catSpend,
      remaining: computeRemaining(row.amount, rolloverFromPrior, catSpend),
    });
  }
  return lines.sort((a, b) => b.spend - a.spend);
}
