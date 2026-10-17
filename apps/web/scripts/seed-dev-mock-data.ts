import "dotenv/config";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db, schema } from "../db";
import { MOCK_INSTITUTIONS } from "../lib/mock/fixtures";
import { syncTransactionsForItem } from "../lib/plaidSync";
import { syncHoldingsForItem, syncInvestmentTransactionsForItem } from "../lib/plaidInvestments";
import { syncLiabilitiesForItem } from "../lib/plaidLiabilities";

// One-off local-dev utility (not wired into any npm script) -- seeds every
// mock institution for a given user, matching /api/mock/connect's logic
// exactly but looped and called directly against the DB so it doesn't need
// a live session/bearer token. Also backfills 90 days of net_worth_snapshots
// with a gently rising, noisy trend so the mobile net worth chart has
// something to plot -- computeAndStoreNetWorthSnapshot always uses *current*
// balances regardless of asOfDate, so calling it repeatedly for past dates
// would just repeat today's number; this writes varied historical values
// directly instead.
async function main() {
  const email = process.argv[2];
  if (!email) {
    console.error("Usage: npx tsx scripts/seed-dev-mock-data.ts <email>");
    process.exit(1);
  }

  const [user] = await db.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.email, email)).limit(1);
  if (!user) {
    console.error(`No user found for ${email}`);
    process.exit(1);
  }
  const userId = user.id;

  const existingItems = await db.query.plaidItems.findMany({ where: eq(schema.plaidItems.userId, userId) });
  const connectedInstitutionIds = new Set(existingItems.map((i) => i.institutionId));

  for (const inst of MOCK_INSTITUTIONS) {
    const institutionId = `mock-${inst.id}`;
    if (connectedInstitutionIds.has(institutionId)) {
      console.log(`Skipping ${inst.name} -- already connected.`);
      continue;
    }

    await db.insert(schema.institutions).values({ id: institutionId, name: inst.name, primaryColor: inst.primaryColor, oauth: false }).onConflictDoNothing();

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

    for (const acct of inst.accounts) {
      await db.insert(schema.accounts).values({
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
      });
    }

    await syncTransactionsForItem(item.id, "initial");
    await syncHoldingsForItem(item.id, "initial");
    await syncInvestmentTransactionsForItem(item.id, "initial");
    await syncLiabilitiesForItem(item.id, "initial");
    console.log(`Seeded ${inst.name}.`);
  }

  // Backfill net worth history so the chart has more than one point.
  const accounts = await db.select().from(schema.accounts).where(eq(schema.accounts.userId, userId));
  const currentAssets = accounts.filter((a) => a.type === "depository" || a.type === "investment").reduce((s, a) => s + (a.currentBalance ?? 0), 0);
  const currentLiabilities = accounts.filter((a) => a.type === "credit" || a.type === "loan").reduce((s, a) => s + (a.currentBalance ?? 0), 0);
  const currentNet = currentAssets - currentLiabilities;

  const days = 90;
  const startNet = Math.round(currentNet * 0.82); // trend up ~18% over the window
  for (let i = days; i >= 1; i--) {
    const date = new Date();
    date.setUTCDate(date.getUTCDate() - i);
    const asOfDate = date.toISOString().slice(0, 10);
    const progress = (days - i) / days;
    const trend = startNet + (currentNet - startNet) * progress;
    const noise = (Math.sin(i * 1.7) + Math.sin(i * 0.4)) * currentNet * 0.01;
    const net = Math.round(trend + noise);
    const liabilities = Math.round(currentLiabilities * (0.85 + progress * 0.15));
    const assets = net + liabilities;

    await db
      .insert(schema.netWorthSnapshots)
      .values({ userId, asOfDate, assets, liabilities, net })
      .onConflictDoUpdate({ target: [schema.netWorthSnapshots.userId, schema.netWorthSnapshots.asOfDate], set: { assets, liabilities, net } });
  }
  console.log(`Backfilled ${days} days of net_worth_snapshots.`);

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
