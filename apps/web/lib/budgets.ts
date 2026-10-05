import { and, eq, gte, isNull, lt, or, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { monthRange, shiftMonth, computeRemaining, budgetColorSlots } from "@tally/core/budgetMath";
import { currentMonthFor } from "@/lib/userTimezone";

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

/**
 * A budget row only ever exists for the month it was explicitly created in —
 * there's no template/recurrence concept, so a fresh month is otherwise a
 * blank slate every time. The first time the actual current month is read
 * with nothing budgeted yet, this copies every line (category, amount,
 * rollover, fixed-amount) from the immediately preceding month, so opening
 * Budgets (or Overview) on the 1st isn't empty. Past and future months are
 * left alone — only "today's" month gets this lazy carry-forward, so
 * browsing Prev/Next never fabricates budgets for a period that never had
 * any. Skips entirely once the current month has even one row, so it never
 * overwrites a month you've already started customizing yourself.
 * onConflictDoNothing guards a race between concurrent requests (Overview
 * and Budgets loading in parallel) both seeing "empty" at once.
 */
async function ensureMonthSeeded(userId: string, month: string): Promise<void> {
  if (month !== (await currentMonthFor(userId))) return;

  const [already] = await db
    .select({ id: schema.budgets.id })
    .from(schema.budgets)
    .where(and(eq(schema.budgets.userId, userId), eq(schema.budgets.month, month)))
    .limit(1);
  if (already) return;

  const priorMonth = shiftMonth(month, -1);
  const priorRows = await db
    .select({
      categoryId: schema.budgets.categoryId,
      amount: schema.budgets.amount,
      rolloverEnabled: schema.budgets.rolloverEnabled,
      isFixedAmount: schema.budgets.isFixedAmount,
    })
    .from(schema.budgets)
    .where(and(eq(schema.budgets.userId, userId), eq(schema.budgets.month, priorMonth)));
  if (priorRows.length === 0) return;

  await db
    .insert(schema.budgets)
    .values(
      priorRows.map((r) => ({
        userId,
        month,
        categoryId: r.categoryId,
        amount: r.amount,
        rolloverEnabled: r.rolloverEnabled,
        isFixedAmount: r.isFixedAmount,
      })),
    )
    .onConflictDoNothing();
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
  /** Parent category's name, for grouping rows; null for a top-level category. */
  parentName: string | null;
  categoryColorSlot: number;
  /** Distinct per budget (budgetColorSlots) -- use this, not categoryColorSlot, to color budget meters/bars. */
  colorSlot: number;
  amount: number;
  rolloverEnabled: boolean;
  rolloverFromPrior: number;
  isFixedAmount: boolean;
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
  await ensureMonthSeeded(userId, month);

  const rows = await db
    .select({
      categoryId: schema.budgets.categoryId,
      amount: schema.budgets.amount,
      rolloverEnabled: schema.budgets.rolloverEnabled,
      isFixedAmount: schema.budgets.isFixedAmount,
      categoryName: schema.categories.name,
      categoryColorSlot: schema.categories.colorSlot,
      parentId: schema.categories.parentId,
    })
    .from(schema.budgets)
    .innerJoin(schema.categories, eq(schema.budgets.categoryId, schema.categories.id))
    .where(and(eq(schema.budgets.userId, userId), eq(schema.budgets.month, month)));

  const [spend, rollup, parentNames] = await Promise.all([spendByCategory(userId, month), categoryRollupMap(userId), categoryNames(userId)]);

  const lines: BudgetLine[] = [];
  for (const row of rows) {
    const rolloverFromPrior = row.rolloverEnabled ? await priorMonthRollover(userId, row.categoryId, month, rollup) : 0;
    const catSpend = rolledUpSpend(spend, rollup, row.categoryId);
    lines.push({
      categoryId: row.categoryId,
      categoryName: row.categoryName,
      parentName: row.parentId ? (parentNames.get(row.parentId) ?? null) : null,
      categoryColorSlot: row.categoryColorSlot,
      colorSlot: 1, // assigned below, once every line is known
      amount: row.amount,
      rolloverEnabled: row.rolloverEnabled,
      rolloverFromPrior,
      isFixedAmount: row.isFixedAmount,
      spend: catSpend,
      remaining: computeRemaining(row.amount, rolloverFromPrior, catSpend),
    });
  }
  const slots = budgetColorSlots(lines);
  for (const line of lines) line.colorSlot = slots.get(line.categoryId) ?? 1;
  return lines.sort((a, b) => b.spend - a.spend);
}

async function categoryNames(userId: string): Promise<Map<string, string>> {
  const cats = await db
    .select({ id: schema.categories.id, name: schema.categories.name })
    .from(schema.categories)
    .where(or(isNull(schema.categories.userId), eq(schema.categories.userId, userId)));
  return new Map(cats.map((c) => [c.id, c.name]));
}

export interface UnbudgetedSpend {
  categoryId: string;
  categoryName: string;
  spend: number;
}

/**
 * Expense spending this month in categories no budget covers (a budget on a
 * parent covers its children) -- the Budgets page's "Not budgeted" row, so
 * the month's spending always adds up.
 */
export async function unbudgetedSpend(userId: string, month: string, lines: BudgetLine[]): Promise<UnbudgetedSpend[]> {
  const [spend, rollup, cats] = await Promise.all([
    spendByCategory(userId, month),
    categoryRollupMap(userId),
    db
      .select({ id: schema.categories.id, name: schema.categories.name, kind: schema.categories.kind })
      .from(schema.categories)
      .where(or(isNull(schema.categories.userId), eq(schema.categories.userId, userId))),
  ]);
  const covered = new Set(lines.flatMap((l) => rollup.get(l.categoryId) ?? [l.categoryId]));
  return cats
    .filter((c) => c.kind === "expense" && !covered.has(c.id) && (spend.get(c.id) ?? 0) > 0)
    .map((c) => ({ categoryId: c.id, categoryName: c.name, spend: spend.get(c.id)! }))
    .sort((a, b) => b.spend - a.spend);
}

/** Rounds a monthly average up to a tidy budget amount ($10 steps). */
function tidy(cents: number): number {
  return Math.ceil(cents / 1000) * 1000;
}

export interface SetupOption {
  count: number;
  total: number;
  rows: { categoryId: string; amount: number; rolloverEnabled: boolean; isFixedAmount: boolean }[];
}

/**
 * The two one-tap ways to fill an empty month: copy the previous month's
 * budgets (amounts only -- rollover carry-in is recomputed), or set each
 * category to its last-3-months average spend. The average covers last
 * month's budgeted categories, or, with none, the 8 biggest expense
 * categories over those months.
 */
export async function budgetSetupOptions(userId: string, month: string): Promise<{ copy: (SetupOption & { fromMonth: string }) | null; average: SetupOption | null }> {
  const fromMonth = shiftMonth(month, -1);
  const prior = await db
    .select({ categoryId: schema.budgets.categoryId, amount: schema.budgets.amount, rolloverEnabled: schema.budgets.rolloverEnabled, isFixedAmount: schema.budgets.isFixedAmount })
    .from(schema.budgets)
    .where(and(eq(schema.budgets.userId, userId), eq(schema.budgets.month, fromMonth)));

  const [rollup, cats, ...spends] = await Promise.all([
    categoryRollupMap(userId),
    db.select({ id: schema.categories.id, kind: schema.categories.kind, parentId: schema.categories.parentId }).from(schema.categories).where(or(isNull(schema.categories.userId), eq(schema.categories.userId, userId))),
    ...[1, 2, 3].map((n) => spendByCategory(userId, shiftMonth(month, -n))),
  ]);
  const avg = (categoryId: string) => spends.reduce((s, m) => s + rolledUpSpend(m, rollup, categoryId), 0) / 3;

  let targets: { categoryId: string; rolloverEnabled: boolean; isFixedAmount: boolean }[] = prior.map((p) => ({ categoryId: p.categoryId, rolloverEnabled: p.rolloverEnabled, isFixedAmount: p.isFixedAmount }));
  if (targets.length === 0) {
    targets = cats
      .filter((c) => c.kind === "expense" && !c.parentId)
      .map((c) => ({ categoryId: c.id, total: avg(c.id) }))
      .filter((c) => c.total > 0)
      .sort((a, b) => b.total - a.total)
      .slice(0, 8)
      .map((c) => ({ categoryId: c.categoryId, rolloverEnabled: false, isFixedAmount: false }));
  }
  const averageRows = targets.map((t) => ({ ...t, amount: tidy(avg(t.categoryId)) })).filter((r) => r.amount > 0);

  return {
    copy: prior.length ? { fromMonth, count: prior.length, total: prior.reduce((s, p) => s + p.amount, 0), rows: prior } : null,
    average: averageRows.length ? { count: averageRows.length, total: averageRows.reduce((s, r) => s + r.amount, 0), rows: averageRows } : null,
  };
}

/** Writes setup rows into a month, never overwriting a budget already there. */
export async function applyBudgetRows(userId: string, month: string, rows: SetupOption["rows"]): Promise<number> {
  if (rows.length === 0) return 0;
  const inserted = await db
    .insert(schema.budgets)
    .values(rows.map((r) => ({ userId, month, categoryId: r.categoryId, amount: r.amount, rolloverEnabled: r.rolloverEnabled, isFixedAmount: r.isFixedAmount })))
    .onConflictDoNothing()
    .returning({ id: schema.budgets.id });
  return inserted.length;
}

export interface BudgetHistoryMonth {
  month: string;
  /** Null when the category had no budget that month. */
  amount: number | null;
  spend: number;
}

/** The last `months` months (oldest first, ending with `month`) of one category's budget and spend. */
export async function budgetHistory(userId: string, categoryId: string, month: string, months = 6): Promise<BudgetHistoryMonth[]> {
  const list = Array.from({ length: months }, (_, i) => shiftMonth(month, i - months + 1));
  const [rollup, budgetRows, ...spends] = await Promise.all([
    categoryRollupMap(userId),
    db
      .select({ month: schema.budgets.month, amount: schema.budgets.amount })
      .from(schema.budgets)
      .where(and(eq(schema.budgets.userId, userId), eq(schema.budgets.categoryId, categoryId), gte(schema.budgets.month, list[0]!), lt(schema.budgets.month, shiftMonth(month, 1)))),
    ...list.map((m) => spendByCategory(userId, m)),
  ]);
  const amountByMonth = new Map(budgetRows.map((b) => [b.month, b.amount]));
  return list.map((m, i) => ({ month: m, amount: amountByMonth.get(m) ?? null, spend: rolledUpSpend(spends[i]!, rollup, categoryId) }));
}
