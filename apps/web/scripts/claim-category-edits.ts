import "dotenv/config";
import { and, eq, inArray, isNull, ne, sql } from "drizzle-orm";
import { db, schema } from "../db";
import { buildCategoryTaxonomy } from "../lib/categoryTaxonomy";

/**
 * One-off: before category_overrides existed, editing a system category
 * changed the shared row itself, and a few categories may have been created
 * with no owner. This finds both by comparing every system row (user_id
 * null) with the taxonomy it was seeded from (lib/categoryTaxonomy.ts) and
 * hands them to one user:
 *
 * - a system row whose slug isn't in the taxonomy was added by a user, so
 *   it becomes that user's category (user_id set);
 * - a taxonomy row whose name, colour, icon or parent differs from the
 *   taxonomy was edited, so the edit becomes that user's override and the
 *   shared row goes back to the taxonomy's values.
 *
 * Dry run by default; --apply writes, all in one transaction.
 *
 *   npx tsx scripts/claim-category-edits.ts --email you@example.com [--apply]
 *
 * (--email defaults to ADMIN_EMAIL.) A row another user's transactions,
 * splits or budgets point at is left alone and listed, never claimed.
 */

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  const apply = process.argv.includes("--apply");
  const email = (arg("--email") ?? process.env.ADMIN_EMAIL)?.toLowerCase().trim();
  if (!email) {
    console.error("Pass --email <owner> or set ADMIN_EMAIL.");
    process.exit(1);
  }
  const [owner] = await db.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.email, email)).limit(1);
  if (!owner) {
    console.error(`No user with email ${email}.`);
    process.exit(1);
  }

  // What every system row should look like, by slug.
  const expected = new Map<string, { name: string; colorSlot: number; parentSlug: string | null }>();
  for (const parent of buildCategoryTaxonomy()) {
    expected.set(parent.slug, { name: parent.name, colorSlot: parent.colorSlot, parentSlug: null });
    for (const child of parent.children) {
      expected.set(child.slug, { name: child.name, colorSlot: parent.colorSlot, parentSlug: parent.slug });
    }
  }

  const system = await db
    .select({ id: schema.categories.id, slug: schema.categories.slug, name: schema.categories.name, colorSlot: schema.categories.colorSlot, icon: schema.categories.icon, parentId: schema.categories.parentId })
    .from(schema.categories)
    .where(isNull(schema.categories.userId));
  const idBySlug = new Map(system.map((c) => [c.slug, c.id]));
  const slugById = new Map(system.map((c) => [c.id, c.slug]));

  const added = system.filter((c) => !expected.has(c.slug));
  const edited = system.flatMap((c) => {
    const want = expected.get(c.slug);
    if (!want) return [];
    const wantParentId = want.parentSlug ? (idBySlug.get(want.parentSlug) ?? null) : null;
    const diffs: string[] = [];
    if (c.name !== want.name) diffs.push(`name "${want.name}" -> "${c.name}"`);
    if (c.colorSlot !== want.colorSlot) diffs.push(`colour ${want.colorSlot} -> ${c.colorSlot}`);
    if (c.icon !== null) diffs.push(`icon -> ${c.icon}`);
    if (c.parentId !== wantParentId) diffs.push(`parent ${want.parentSlug ?? "(top)"} -> ${c.parentId ? (slugById.get(c.parentId) ?? c.parentId) : "(top)"}`);
    return diffs.length > 0 ? [{ row: c, want, wantParentId, diffs }] : [];
  });

  // A user-added row someone else's data uses can't silently become the
  // owner's private category -- those are reported, not claimed.
  const addedIds = added.map((c) => c.id);
  const usedByOthers = new Set<string>();
  if (addedIds.length > 0) {
    const refs = await Promise.all([
      db.selectDistinct({ id: schema.transactions.categoryId }).from(schema.transactions).where(and(inArray(schema.transactions.categoryId, addedIds), ne(schema.transactions.userId, owner.id))),
      db.selectDistinct({ id: schema.budgets.categoryId }).from(schema.budgets).where(and(inArray(schema.budgets.categoryId, addedIds), ne(schema.budgets.userId, owner.id))),
      db
        .selectDistinct({ id: schema.transactionSplits.categoryId })
        .from(schema.transactionSplits)
        .innerJoin(schema.transactions, eq(schema.transactionSplits.transactionId, schema.transactions.id))
        .where(and(inArray(schema.transactionSplits.categoryId, addedIds), ne(schema.transactions.userId, owner.id))),
    ]);
    for (const r of refs.flat()) if (r.id) usedByOthers.add(r.id);
  }
  const toClaim = added.filter((c) => !usedByOthers.has(c.id));

  console.log(`Owner: ${email}`);
  console.log(`\nAdded by a user, to claim (${toClaim.length}):`);
  for (const c of toClaim) console.log(`  ${c.name}  [${c.slug}]`);
  if (usedByOthers.size > 0) {
    console.log(`\nAdded by a user but used by someone else too -- left alone (${usedByOthers.size}):`);
    for (const c of added.filter((a) => usedByOthers.has(a.id))) console.log(`  ${c.name}  [${c.slug}]`);
  }
  console.log(`\nSystem categories edited, to move into overrides (${edited.length}):`);
  for (const e of edited) console.log(`  ${e.row.slug}: ${e.diffs.join("; ")}`);

  if (!apply) {
    console.log("\nDry run -- nothing written. Re-run with --apply to make these changes.");
    process.exit(0);
  }

  await db.transaction(async (tx) => {
    if (toClaim.length > 0) {
      await tx.update(schema.categories).set({ userId: owner.id }).where(inArray(schema.categories.id, toClaim.map((c) => c.id)));
    }
    for (const e of edited) {
      // An override the owner already has wins; otherwise their edit as it
      // stands on the shared row becomes it.
      await tx
        .insert(schema.categoryOverrides)
        .values({ userId: owner.id, categoryId: e.row.id, name: e.row.name, colorSlot: e.row.colorSlot, icon: e.row.icon, parentId: e.row.parentId })
        .onConflictDoNothing();
      await tx
        .update(schema.categories)
        .set({ name: e.want.name, colorSlot: e.want.colorSlot, icon: null, parentId: e.wantParentId })
        .where(eq(schema.categories.id, e.row.id));
    }
  });

  const [counted] = await db.select({ n: sql<number>`count(*)::int` }).from(schema.categoryOverrides).where(eq(schema.categoryOverrides.userId, owner.id));
  console.log(`\nDone: ${toClaim.length} claimed, ${edited.length} moved to overrides (${counted?.n ?? 0} overrides for this user now).`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
