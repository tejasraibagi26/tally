import "dotenv/config";
import { randomUUID, randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { eq, isNull, or } from "drizzle-orm";
import { db, schema } from "../db";
import { DEMO_EMAIL } from "../lib/demo";
import { MOCK_INSTITUTIONS } from "../lib/mock/fixtures";
import { isMockPlaidItemId } from "../lib/mock/isMock";
import { generateDemoTransactions, DEMO_MONTHS } from "../lib/demo/demoTransactions";
import { toInternalAmountCents } from "../lib/transactionSync/mapPlaidTransaction";
import { categorizeTransactions } from "../lib/categorize";
import { detectTransfersForUser } from "../lib/transfers";
import { detectRecurringForUser } from "../lib/recurring";
import { syncHoldingsForItem, syncInvestmentTransactionsForItem } from "../lib/plaidInvestments";
import { syncLiabilitiesForItem } from "../lib/plaidLiabilities";

/**
 * Seeds (or re-seeds) the public read-only demo account — `npm run seed:demo`.
 *
 * Idempotent by deletion: it drops the existing demo user entirely and
 * rebuilds from scratch, so running it again resets the demo to a known
 * state rather than layering more data on top. Safe to run on a schedule if
 * you want the demo's "today" to keep moving — all dates are relative to the
 * run, so a demo seeded in January still looks current in June if re-run.
 *
 * Only the demo user is ever touched. It is matched by the fixed address in
 * lib/demo.ts, so this can't collide with a real account.
 *
 * The accounts it creates carry `mock-item-*` Plaid item ids, which is load
 * bearing: that prefix is what makes lib/plaidSync.ts and friends seed from
 * fixtures instead of calling Plaid (lib/mock/isMock.ts). So the demo needs
 * no Plaid credentials, and a nightly cron that picks the demo item up just
 * re-seeds fixtures harmlessly instead of erroring on a fake access token.
 */

/** Monthly budgets, by category slug. Amounts are tuned to the generator's
 *  spend in lib/demo/demoTransactions.ts so the Budgets screen shows a real
 *  mix — a couple comfortably under, food and drink running close. */
const DEMO_BUDGETS: { slug: string; amount: number; fixed?: boolean; rollover?: boolean }[] = [
  { slug: "rent-and-utilities", amount: 2_450_00, fixed: true },
  { slug: "food-and-drink", amount: 700_00 },
  { slug: "general-merchandise", amount: 300_00 },
  { slug: "transportation", amount: 220_00 },
  { slug: "personal-care", amount: 215_00, fixed: true },
  { slug: "travel", amount: 150_00, rollover: true },
  { slug: "entertainment", amount: 40_00 },
  { slug: "medical", amount: 60_00 },
];

/** How many months of budgets to write, counting back from this month. */
const BUDGET_MONTHS = 7;

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function monthStart(offsetFromThisMonth: number): string {
  const now = new Date();
  return iso(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + offsetFromThisMonth, 1)));
}

async function main() {
  // --- 0. Refuse to touch anything that isn't the demo --------------------
  // This script resets by deleting, so a mistargeted run is destructive and
  // unrecoverable. DEMO_EMAIL is on a reserved .invalid domain precisely so
  // it can't belong to a real person, but an operator who points ADMIN_EMAIL
  // at it (or edits lib/demo.ts) would be aiming this at their own account.
  if (process.env.ADMIN_EMAIL?.toLowerCase().trim() === DEMO_EMAIL) {
    console.error(
      `Refusing to run: ADMIN_EMAIL is set to ${DEMO_EMAIL}, the demo address.\n` +
        `This script deletes that account to reset it, which would destroy your admin user.\n` +
        `Point ADMIN_EMAIL at a different address first.`,
    );
    process.exit(1);
  }

  // --- 1. Reset -----------------------------------------------------------
  const [existing] = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(eq(schema.users.email, DEMO_EMAIL))
    .limit(1);

  if (existing) {
    // Last line of defence: a demo account only ever holds mock-* Plaid
    // items (step 3 below). A real Plaid connection here means this address
    // is in use by someone's actual account, and deleting it would take
    // their financial history with it.
    const items = await db
      .select({ plaidItemId: schema.plaidItems.plaidItemId })
      .from(schema.plaidItems)
      .where(eq(schema.plaidItems.userId, existing.id));
    const real = items.filter((i) => !isMockPlaidItemId(i.plaidItemId));
    if (real.length > 0) {
      console.error(
        `Refusing to run: the account at ${DEMO_EMAIL} has ${real.length} real Plaid connection(s).\n` +
          `That isn't a seeded demo account, and resetting it would delete real data.`,
      );
      process.exit(1);
    }

    // Every demo table hangs off users.id with onDelete: "cascade", so this
    // one delete clears accounts, transactions, budgets, holdings, snapshots
    // and the rest in a single step.
    await db.delete(schema.users).where(eq(schema.users.id, existing.id));
    console.log("Cleared the previous demo account.");
  }

  // --- 2. The demo user ---------------------------------------------------
  // A random password nobody holds: the only way into this account is the
  // passwordless `demo` provider (lib/auth.ts), which is what guarantees
  // every demo session carries the read-only `demo` token claim.
  const unusablePassword = await bcrypt.hash(randomBytes(32).toString("hex"), 10);
  const [user] = await db
    .insert(schema.users)
    .values({
      email: DEMO_EMAIL,
      passwordHash: unusablePassword,
      name: "John Doe",
      timezone: "America/New_York",
      // Nothing should ever email the demo account.
      recapsEnabled: false,
    })
    .returning({ id: schema.users.id });
  if (!user) throw new Error("Failed to create the demo user");
  const userId = user.id;
  console.log(`Created demo user ${DEMO_EMAIL}.`);

  // --- 3. Institutions, items, accounts -----------------------------------
  const accountsBySubtype = new Map<string, string>(); // subtype -> accounts.id
  const itemIds: string[] = [];

  for (const inst of MOCK_INSTITUTIONS) {
    const institutionId = `mock-${inst.id}`;
    await db
      .insert(schema.institutions)
      .values({ id: institutionId, name: inst.name, primaryColor: inst.primaryColor, oauth: false })
      .onConflictDoNothing();

    const [item] = await db
      .insert(schema.plaidItems)
      .values({
        userId,
        plaidItemId: `mock-item-${randomUUID()}`,
        institutionId,
        institutionName: inst.name,
        accessTokenCiphertext: "mock",
        accessTokenIv: "mock",
        accessTokenTag: "mock",
        status: "healthy",
        lastSyncedAt: new Date(),
      })
      .returning({ id: schema.plaidItems.id });
    if (!item) throw new Error(`Failed to insert plaid_items row for ${inst.name}`);
    itemIds.push(item.id);

    for (const acct of inst.accounts) {
      const [row] = await db
        .insert(schema.accounts)
        .values({
          userId,
          itemId: item.id,
          plaidAccountId: `mock-acct-${randomUUID()}`,
          name: acct.name,
          officialName: acct.officialName,
          mask: acct.mask,
          type: acct.type,
          subtype: acct.subtype,
          currency: "USD",
          currentBalance: acct.currentBalance,
          availableBalance: acct.availableBalance,
          creditLimit: acct.creditLimit,
          balanceAsOf: new Date(),
        })
        .returning({ id: schema.accounts.id });
      if (!row) throw new Error(`Failed to insert account ${acct.name}`);
      // The generator addresses accounts by subtype. Harbor's joint checking
      // shares "checking" with Ridgeline's, so first one wins and the joint
      // account stays deliberately quiet — a plausible second bank that
      // isn't the one the household actually runs its spending through.
      if (!accountsBySubtype.has(acct.subtype)) accountsBySubtype.set(acct.subtype, row.id);
    }
  }
  console.log(`Connected ${MOCK_INSTITUTIONS.length} institutions.`);

  // --- 4. Transactions ----------------------------------------------------
  const generated = generateDemoTransactions();
  const rows = generated.flatMap((t, index) => {
    const accountId = accountsBySubtype.get(t.subtype);
    if (!accountId) return [];
    return [
      {
        userId,
        accountId,
        plaidTransactionId: `mock-txn-demo-${index}`,
        isPending: t.pending ?? false,
        amount: toInternalAmountCents(t.amount),
        currency: "USD",
        postedDate: t.date,
        authorizedDate: t.date,
        name: t.name,
        merchantName: t.merchantName,
        paymentChannel: t.merchantName ? "in store" : "other",
        pfcPrimary: t.pfcPrimary,
        pfcDetailed: t.pfcDetailed,
        pfcConfidence: "VERY_HIGH",
        categorySource: "plaid" as const,
      },
    ];
  });

  // Chunked: a single 2,000-row insert blows past the parameter limit.
  const inserted: string[] = [];
  for (let i = 0; i < rows.length; i += 500) {
    const batch = await db
      .insert(schema.transactions)
      .values(rows.slice(i, i + 500))
      .returning({ id: schema.transactions.id });
    inserted.push(...batch.map((r) => r.id));
  }
  console.log(`Inserted ${inserted.length} transactions across ${DEMO_MONTHS} months.`);

  for (let i = 0; i < inserted.length; i += 500) {
    await categorizeTransactions(userId, inserted.slice(i, i + 500));
  }
  console.log("Categorized.");

  // --- 5. Investments + liabilities --------------------------------------
  // These route to the mock fixtures off the mock-item- prefix, so they work
  // with no Plaid credentials and regardless of MOCK_DATA.
  for (const itemId of itemIds) {
    await syncHoldingsForItem(itemId, "initial");
    await syncInvestmentTransactionsForItem(itemId, "initial");
    await syncLiabilitiesForItem(itemId, "initial");
  }
  console.log("Seeded holdings, investment activity, and card liabilities.");

  // --- 6. Budgets ---------------------------------------------------------
  // System categories (seed:categories) have a null user_id; a renamed one
  // would be user-owned. Accept either so this works on both.
  const slugs = DEMO_BUDGETS.map((b) => b.slug);
  const categories = await db
    .select({ id: schema.categories.id, slug: schema.categories.slug })
    .from(schema.categories)
    .where(or(isNull(schema.categories.userId), eq(schema.categories.userId, userId)));
  const categoryIdBySlug = new Map(
    categories.filter((c) => slugs.includes(c.slug)).map((c) => [c.slug, c.id] as const),
  );

  const missing = slugs.filter((s) => !categoryIdBySlug.has(s));
  if (missing.length > 0) {
    console.warn(
      `Skipping budgets for ${missing.join(", ")} — no such category. Run \`npm run seed:categories\` first for the full demo.`,
    );
  }

  const budgetRows = [];
  for (let back = BUDGET_MONTHS - 1; back >= 0; back--) {
    const month = monthStart(-back);
    for (const b of DEMO_BUDGETS) {
      const categoryId = categoryIdBySlug.get(b.slug);
      if (!categoryId) continue;
      budgetRows.push({
        userId,
        month,
        categoryId,
        amount: b.amount,
        rolloverEnabled: b.rollover ?? false,
        isFixedAmount: b.fixed ?? false,
      });
    }
  }
  if (budgetRows.length > 0) {
    await db.insert(schema.budgets).values(budgetRows).onConflictDoNothing();
    console.log(`Set ${budgetRows.length} budgets across ${BUDGET_MONTHS} months.`);
  }

  // --- 7. Derived: transfer pairs + recurring streams --------------------
  const pairs = await detectTransfersForUser(userId);
  await detectRecurringForUser(userId);
  console.log(`Paired ${pairs} transfers and detected recurring streams.`);

  // --- 8. Net worth history ----------------------------------------------
  // computeAndStoreNetWorthSnapshot always uses *current* balances whatever
  // date you pass, so calling it per past day would just repeat today's
  // number. Write the trend directly instead, same approach as
  // scripts/seed-dev-mock-data.ts but over the full demo window.
  const accountRows = await db.select().from(schema.accounts).where(eq(schema.accounts.userId, userId));
  const currentAssets = accountRows
    .filter((a) => a.type === "depository" || a.type === "investment")
    .reduce((s, a) => s + (a.currentBalance ?? 0), 0);
  const currentLiabilities = accountRows
    .filter((a) => a.type === "credit" || a.type === "loan")
    .reduce((s, a) => s + (a.currentBalance ?? 0), 0);
  const currentNet = currentAssets - currentLiabilities;

  const days = DEMO_MONTHS * 31;
  const startNet = Math.round(currentNet * 0.74); // a year of steady saving
  const snapshots = [];
  for (let i = days; i >= 0; i--) {
    const date = new Date();
    date.setUTCDate(date.getUTCDate() - i);
    const progress = (days - i) / days;
    const trend = startNet + (currentNet - startNet) * progress;
    // Two out-of-phase waves so the line reads as a market, not a sine curve.
    const noise = (Math.sin(i * 0.21) * 0.6 + Math.sin(i * 0.067) * 1.4) * currentNet * 0.012;
    const net = Math.round(trend + noise);
    const liabilities = Math.round(currentLiabilities * (0.8 + progress * 0.2));
    snapshots.push({ userId, asOfDate: iso(date), assets: net + liabilities, liabilities, net });
  }
  for (let i = 0; i < snapshots.length; i += 500) {
    await db.insert(schema.netWorthSnapshots).values(snapshots.slice(i, i + 500)).onConflictDoNothing();
  }
  console.log(`Backfilled ${snapshots.length} days of net worth history.`);

  // --- 9. FIRE planner defaults ------------------------------------------
  // So /fire shows a projection on arrival instead of an empty setup form.
  await db
    .insert(schema.fireSettings)
    .values({ userId, swr: "0.0400", expectedReturn: "0.0700", inflation: "0.0250" })
    .onConflictDoNothing();

  console.log("\nDemo ready — /demo is live. Re-run this to reset it.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
