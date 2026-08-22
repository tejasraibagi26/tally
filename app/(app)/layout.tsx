import { redirect } from "next/navigation";
import { eq, and, sql } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db, schema } from "@/db";
import { SideNav } from "@/components/nav/SideNav";
import { TopBar } from "@/components/nav/TopBar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const userId = (session.user as { id: string }).id;

  const [[user], [txnCount], [acctCount], [cardCount]] = await Promise.all([
    db.select({ name: schema.users.name, email: schema.users.email }).from(schema.users).where(eq(schema.users.id, userId)).limit(1),
    db.select({ count: sql<number>`count(*)::int` }).from(schema.transactions).where(eq(schema.transactions.userId, userId)),
    db.select({ count: sql<number>`count(*)::int` }).from(schema.accounts).where(eq(schema.accounts.userId, userId)),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.accounts)
      .where(and(eq(schema.accounts.userId, userId), eq(schema.accounts.type, "credit"))),
  ]);

  return (
    <div className="flex h-screen overflow-hidden bg-canvas">
      <SideNav
        user={{ name: user?.name ?? null, email: user?.email ?? session.user.email ?? "" }}
        counts={{
          transactions: txnCount?.count ?? 0,
          accounts: acctCount?.count ?? 0,
          creditCards: cardCount?.count ?? 0,
        }}
      />
      <div className="flex-1 flex flex-col min-w-0 h-screen">
        <TopBar userEmail={session.user.email ?? ""} />
        <main className="flex-1 min-w-0 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
