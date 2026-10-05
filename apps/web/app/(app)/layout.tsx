import { redirect } from "next/navigation";
import { eq, and, gte, lt, sql } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db, schema } from "@/db";
import { SideNav } from "@/components/nav/SideNav";
import { MobileNav } from "@/components/nav/MobileNav";
import { MOCK_MODE } from "@/lib/config";
import { monthRange } from "@tally/core/budgetMath";
import { currentMonthFor } from "@/lib/userTimezone";
import { itemStatusToBadge } from "@/lib/freshness";
import { connectionState } from "@tally/core/connectionState";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const userId = (session.user as { id: string }).id;
  // Matches the Transactions page's own default (unfiltered) view, which
  // defaults to the current month — this nav badge should read as "how many
  // are waiting in Transactions right now," not an all-time total.
  const { start, end } = monthRange((await currentMonthFor(userId)));

  const [[user], [txnCount], [acctCount], [cardCount], items] = await Promise.all([
    db.select({ name: schema.users.name, email: schema.users.email }).from(schema.users).where(eq(schema.users.id, userId)).limit(1),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.transactions)
      .where(and(eq(schema.transactions.userId, userId), gte(schema.transactions.postedDate, start), lt(schema.transactions.postedDate, end))),
    db.select({ count: sql<number>`count(*)::int` }).from(schema.accounts).where(eq(schema.accounts.userId, userId)),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.accounts)
      .where(and(eq(schema.accounts.userId, userId), eq(schema.accounts.type, "credit"))),
    db
      .select({
        institutionName: schema.plaidItems.institutionName,
        status: schema.plaidItems.status,
        lastSyncedAt: schema.plaidItems.lastSyncedAt,
        transactionsUpdateStatus: schema.plaidItems.transactionsUpdateStatus,
      })
      .from(schema.plaidItems)
      .where(eq(schema.plaidItems.userId, userId)),
  ]);

  // Same contract as the Accounts page, so the sidebar badge and the page's
  // "Needs you" panel always count the same banks.
  const idle = { refreshing: false, linking: false, justReconnected: false, refreshFailed: false };
  const needsYou = items
    .map((i) => ({ name: i.institutionName ?? "A bank", state: connectionState({ ...i, badge: itemStatusToBadge(i.status, i.lastSyncedAt, i.transactionsUpdateStatus) }, idle) }))
    .filter((i) => i.state.needsAttention);

  const navUser = { name: user?.name ?? null, email: user?.email ?? session.user.email ?? "" };
  const navCounts = {
    transactions: txnCount?.count ?? 0,
    accounts: acctCount?.count ?? 0,
    creditCards: cardCount?.count ?? 0,
    accountsAttention: {
      count: needsYou.length,
      blocked: needsYou.some((i) => i.state.level === "blocked"),
      names: needsYou.map((i) => i.name),
    },
  };

  return (
    <div className="flex flex-col lg:flex-row h-screen overflow-hidden bg-canvas">
      <div className="hidden lg:flex lg:flex-none">
        <SideNav user={navUser} counts={navCounts} mockMode={MOCK_MODE} />
      </div>
      <MobileNav user={navUser} counts={navCounts} mockMode={MOCK_MODE} />
      <div className="flex-1 flex flex-col min-w-0 min-h-0">
        <main className="flex-1 min-w-0 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
