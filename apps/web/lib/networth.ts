import { and, desc, eq, gte } from "drizzle-orm";
import { db, schema } from "@/db";
import { toNetWorthCurrency } from "@tally/core/fx";

/** §9 "Net worth": Σ depository + investment balances − Σ credit + loan balances, as of now. One row per user per day (§5). */
export async function computeAndStoreNetWorthSnapshot(userId: string, asOfDate: string): Promise<void> {
  const rawAccounts = await db.select().from(schema.accounts).where(eq(schema.accounts.userId, userId));

  // Every other balance/holding display in this app stays labeled in its own
  // currency, never converted — but a single net worth figure can't honor
  // that the same way. Summing raw USD and CAD cents together isn't merely
  // "unconverted," it's arithmetically wrong, so this is the one place a
  // real FX rate is worth fetching (lib/fx.ts).
  const accounts = await Promise.all(
    rawAccounts.map(async (a) => ({
      ...a,
      currentBalance: a.currentBalance != null ? await toNetWorthCurrency(a.currentBalance, a.currency) : null,
    })),
  );

  const assets = accounts.filter((a) => a.type === "depository" || a.type === "investment").reduce((s, a) => s + (a.currentBalance ?? 0), 0);
  const liabilities = accounts.filter((a) => a.type === "credit" || a.type === "loan").reduce((s, a) => s + (a.currentBalance ?? 0), 0);
  const net = assets - liabilities;

  const breakdown = {
    byType: {
      depository: sumByType(accounts, "depository"),
      investment: sumByType(accounts, "investment"),
      credit: sumByType(accounts, "credit"),
      loan: sumByType(accounts, "loan"),
    },
  };

  const values = { userId, asOfDate, assets, liabilities, net, breakdown };
  await db
    .insert(schema.netWorthSnapshots)
    .values(values)
    .onConflictDoUpdate({ target: [schema.netWorthSnapshots.userId, schema.netWorthSnapshots.asOfDate], set: values });
}

function sumByType(accounts: { type: string; currentBalance: number | null }[], type: string): number {
  return accounts.filter((a) => a.type === type).reduce((s, a) => s + (a.currentBalance ?? 0), 0);
}

export interface NetWorthPoint {
  asOfDate: string;
  net: number;
  assets: number;
  liabilities: number;
}

/**
 * §9 "12-month trend" — whatever daily snapshots exist within the window;
 * there's no history before this feature shipped, so a fresh install just
 * shows fewer points. Refreshes today's snapshot first (same computation
 * the nightly cron uses, just on-demand) so the trend's last point always
 * reflects live account balances -- without this, the chart's rightmost
 * point could lag up to a day behind the hero net-worth figure shown
 * alongside it, which is computed fresh from current balances every time.
 */
export async function netWorthTrend(userId: string, days = 365): Promise<NetWorthPoint[]> {
  await computeAndStoreNetWorthSnapshot(userId, new Date().toISOString().slice(0, 10));

  const since = new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
  const rows = await db
    .select({ asOfDate: schema.netWorthSnapshots.asOfDate, net: schema.netWorthSnapshots.net, assets: schema.netWorthSnapshots.assets, liabilities: schema.netWorthSnapshots.liabilities })
    .from(schema.netWorthSnapshots)
    .where(and(eq(schema.netWorthSnapshots.userId, userId), gte(schema.netWorthSnapshots.asOfDate, since)))
    .orderBy(desc(schema.netWorthSnapshots.asOfDate));
  return rows.reverse();
}
