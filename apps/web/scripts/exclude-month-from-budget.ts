import "dotenv/config";
import { and, eq, gte, lt } from "drizzle-orm";
import { db, schema } from "../db";

/**
 * One-off utility: sets excludedFromBudget on every transaction posted in a
 * given calendar month for a user, so a month with unusual one-off activity
 * (e.g. a relocation — moving costs, deposits, temporary double-paying rent)
 * stops counting as regular income/expense in budgets and analytics, without
 * deleting the rows or touching anything outside that window.
 *
 * This intentionally reuses the same excludedFromBudget column the
 * transaction detail panel's "Exclude from budget" toggle writes
 * (app/api/transactions/[id]/route.ts) and the bulk-select action writes
 * (app/api/transactions/bulk/route.ts) — every income/expense aggregate in
 * the app (lib/budgets.ts, lib/analytics.ts) already filters on it, so this
 * doesn't require touching any read path. It does NOT null out amounts —
 * amount is NOT NULL, and the app has no other notion of "blank" income/
 * expense; "excluded" is what makes a transaction stop counting.
 *
 * Runs as a dry run by default (prints what it would change); pass --apply
 * to actually write.
 *
 *   npx tsx scripts/exclude-month-from-budget.ts <email> <YYYY-MM>
 *   npx tsx scripts/exclude-month-from-budget.ts <email> <YYYY-MM> --apply
 */
async function main() {
  const email = process.argv[2];
  const monthArg = process.argv[3];
  const apply = process.argv.includes("--apply");

  if (!email || !monthArg || !/^\d{4}-\d{2}$/.test(monthArg)) {
    console.error("Usage: npx tsx scripts/exclude-month-from-budget.ts <email> <YYYY-MM> [--apply]");
    process.exit(1);
  }

  const [user] = await db.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.email, email)).limit(1);
  if (!user) {
    console.error(`No user found for ${email}`);
    process.exit(1);
  }

  // Both groups are guaranteed by the /^\d{4}-\d{2}$/ check above.
  const [year, month] = monthArg.split("-").map(Number) as [number, number];
  const start = `${monthArg}-01`;
  const end = month === 12 ? `${year + 1}-01-01` : `${year}-${String(month + 1).padStart(2, "0")}-01`;

  const inRange = and(
    eq(schema.transactions.userId, user.id),
    gte(schema.transactions.postedDate, start),
    lt(schema.transactions.postedDate, end),
  );

  const rows = await db
    .select({
      id: schema.transactions.id,
      amount: schema.transactions.amount,
      excludedFromBudget: schema.transactions.excludedFromBudget,
    })
    .from(schema.transactions)
    .where(inRange);

  const alreadyExcluded = rows.filter((r) => r.excludedFromBudget).length;
  const toChange = rows.length - alreadyExcluded;
  const income = rows.filter((r) => r.amount > 0).reduce((sum, r) => sum + r.amount, 0);
  const expense = rows.filter((r) => r.amount < 0).reduce((sum, r) => sum + r.amount, 0);

  console.log(`${monthArg}: ${rows.length} transaction(s) for ${email} (${start} – ${end}, exclusive).`);
  console.log(`  Income:  ${(income / 100).toFixed(2)}`);
  console.log(`  Expense: ${(expense / 100).toFixed(2)}`);
  console.log(`  Already excluded: ${alreadyExcluded}. Would newly exclude: ${toChange}.`);

  if (!apply) {
    console.log("\nDry run only — no changes made. Re-run with --apply to write these.");
    process.exit(0);
  }

  if (toChange === 0) {
    console.log("\nNothing to update.");
    process.exit(0);
  }

  await db.update(schema.transactions).set({ excludedFromBudget: true }).where(inRange);
  console.log(`\nDone — ${toChange} transaction(s) marked excludedFromBudget.`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
