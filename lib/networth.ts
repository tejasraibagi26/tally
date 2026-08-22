import { and, desc, eq, gte } from "drizzle-orm";
import { db, schema } from "@/db";

/** §9 "Net worth": Σ depository + investment balances − Σ credit + loan balances, as of now. One row per user per day (§5). */
export async function computeAndStoreNetWorthSnapshot(userId: string, asOfDate: string): Promise<void> {
  const accounts = await db.select().from(schema.accounts).where(eq(schema.accounts.userId, userId));

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

/** §9 "12-month trend" — whatever daily snapshots exist within the window; there's no history before this feature shipped, so a fresh install just shows fewer points. */
export async function netWorthTrend(userId: string, days = 365): Promise<NetWorthPoint[]> {
  const since = new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
  const rows = await db
    .select({ asOfDate: schema.netWorthSnapshots.asOfDate, net: schema.netWorthSnapshots.net, assets: schema.netWorthSnapshots.assets, liabilities: schema.netWorthSnapshots.liabilities })
    .from(schema.netWorthSnapshots)
    .where(and(eq(schema.netWorthSnapshots.userId, userId), gte(schema.netWorthSnapshots.asOfDate, since)))
    .orderBy(desc(schema.netWorthSnapshots.asOfDate));
  return rows.reverse();
}
