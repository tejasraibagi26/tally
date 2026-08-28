import { NextResponse } from "next/server";
import { z } from "zod";
import { eq, inArray } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireUserId } from "@/lib/session";
import { applyRulesToExistingTransactions } from "@/lib/categorize";

const splitSchema = z.object({ categoryId: z.string().uuid(), amount: z.number().int(), note: z.string().max(200).nullable().optional() });

// Detail endpoint for the mobile app's transaction detail sheet
// (MOBILE_DESIGN.md §5.4) -- the web app renders detail inline from its
// already-fetched list, so this never existed until mobile needed a
// standalone fetch. Same shape as a row from GET /api/transactions.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  let userId: string;
  try {
    userId = await requireUserId(req);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const [t] = await db.select().from(schema.transactions).where(eq(schema.transactions.id, id)).limit(1);
  if (!t || t.userId !== userId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const splitRows = await db
    .select({ categoryId: schema.transactionSplits.categoryId, amount: schema.transactionSplits.amount, note: schema.transactionSplits.note })
    .from(schema.transactionSplits)
    .where(inArray(schema.transactionSplits.transactionId, [t.id]));

  return NextResponse.json({
    id: t.id,
    postedDate: t.postedDate,
    merchantName: t.merchantName,
    name: t.name,
    isPending: t.isPending,
    accountId: t.accountId,
    categoryId: t.categoryId,
    categorySource: t.categorySource,
    pfcDetailed: t.pfcDetailed,
    amount: t.amount,
    currency: t.currency,
    reviewed: t.reviewed,
    notes: t.notes,
    tags: t.tags,
    excludedFromBudget: t.excludedFromBudget,
    plaidTransactionId: t.plaidTransactionId,
    isManual: t.isManual,
    splits: splitRows.filter((s) => s.categoryId).map((s) => ({ categoryId: s.categoryId as string, amount: s.amount, note: s.note })),
  });
}

const patchSchema = z.object({
  categoryId: z.string().uuid().nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
  tags: z.array(z.string().min(1).max(40)).optional(),
  excluded: z.boolean().optional(),
  reviewed: z.boolean().optional(),
  splits: z.array(splitSchema).optional(),
  // "Always categorize Merchant X this way" (§7.2) — creates a rule from this edit.
  alwaysCategorizeMerchant: z.boolean().optional(),
});

// A human editing a transaction is the highest-precedence categorization
// source (§7.1: plaid < ml < rule < manual) — once set here, sync never
// touches categoryId/categorySource again (mergeTransactionUpdate) and the
// rules engine skips this row entirely (categorize.ts only ever queries
// category_source != 'manual').
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  let userId: string;
  try {
    userId = await requireUserId(req);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const [existing] = await db
    .select({ id: schema.transactions.id, userId: schema.transactions.userId, merchantName: schema.transactions.merchantName, name: schema.transactions.name, amount: schema.transactions.amount })
    .from(schema.transactions)
    .where(eq(schema.transactions.id, id))
    .limit(1);
  if (!existing || existing.userId !== userId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const parsed = patchSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request", issues: parsed.error.issues }, { status: 400 });
  }
  const { categoryId, notes, tags, excluded, reviewed, splits, alwaysCategorizeMerchant } = parsed.data;

  const update: Partial<typeof schema.transactions.$inferInsert> = {};
  if (categoryId !== undefined) {
    update.categoryId = categoryId;
    update.categorySource = "manual";
  }
  if (notes !== undefined) update.notes = notes;
  if (tags !== undefined) update.tags = tags;
  if (excluded !== undefined) update.excludedFromBudget = excluded;
  if (reviewed !== undefined) update.reviewed = reviewed;

  if (Object.keys(update).length > 0) {
    await db.update(schema.transactions).set(update).where(eq(schema.transactions.id, id));
  }

  if (splits !== undefined) {
    await db.delete(schema.transactionSplits).where(eq(schema.transactionSplits.transactionId, id));
    if (splits.length > 0) {
      await db.insert(schema.transactionSplits).values(splits.map((s) => ({ transactionId: id, categoryId: s.categoryId, amount: s.amount, note: s.note ?? null })));
    }
  }

  let createdRuleId: string | null = null;
  if (alwaysCategorizeMerchant && categoryId && existing.merchantName) {
    const [lowestPriorityRow] = await db
      .select({ priority: schema.rules.priority })
      .from(schema.rules)
      .where(eq(schema.rules.userId, userId))
      .orderBy(schema.rules.priority)
      .limit(1);
    const [created] = await db
      .insert(schema.rules)
      .values({
        userId,
        // Lower number = higher priority (rulesEngine.ts) — go one below the
        // current highest-priority rule so an explicit "always do this" wins.
        priority: (lowestPriorityRow?.priority ?? 0) - 1,
        enabled: true,
        match: { field: "merchant", op: "equals", value: existing.merchantName },
        actions: { setCategoryId: categoryId },
      })
      .returning({ id: schema.rules.id });
    createdRuleId = created?.id ?? null;
    if (createdRuleId) await applyRulesToExistingTransactions(userId);
  }

  const [updated] = await db.select().from(schema.transactions).where(eq(schema.transactions.id, id)).limit(1);
  return NextResponse.json({ transaction: updated, createdRuleId });
}

// Manual-only: a Plaid-synced row has no business being deleted here — it'd
// just come back on the next sync — so this only ever removes a row that
// isManual (currently: a generated-paycheck transaction, lib/incomeSchedule.ts).
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  let userId: string;
  try {
    userId = await requireUserId(req);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const [existing] = await db
    .select({ id: schema.transactions.id, userId: schema.transactions.userId, isManual: schema.transactions.isManual })
    .from(schema.transactions)
    .where(eq(schema.transactions.id, id))
    .limit(1);
  if (!existing || existing.userId !== userId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!existing.isManual) {
    return NextResponse.json({ error: "Only manually-added transactions can be deleted" }, { status: 400 });
  }

  await db.delete(schema.transactions).where(eq(schema.transactions.id, id));
  return NextResponse.json({ ok: true });
}
