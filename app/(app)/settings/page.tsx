import Link from "next/link";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireUserId } from "@/lib/session";
import { Card, CardHeader } from "@/components/ui/Card";
import { AccountForm } from "@/components/settings/AccountForm";
import { PasswordForm } from "@/components/settings/PasswordForm";
import { DangerZone } from "@/components/settings/DangerZone";

export default async function SettingsPage() {
  const userId = await requireUserId();

  const [user] = await db.select().from(schema.users).where(eq(schema.users.id, userId)).limit(1);
  const items = await db.select({ id: schema.plaidItems.id }).from(schema.plaidItems).where(eq(schema.plaidItems.userId, userId));

  return (
    <div className="max-w-[720px] mx-auto px-8 py-7 flex flex-col gap-6">
      <h1 className="text-2xl font-semibold text-text">Settings</h1>

      <Card>
        <CardHeader title="Account" />
        <div className="p-5">
          <AccountForm initialName={user?.name ?? ""} initialEmail={user?.email ?? ""} />
        </div>
      </Card>

      <Card>
        <CardHeader title="Password" />
        <div className="p-5">
          <PasswordForm />
        </div>
      </Card>

      <Card>
        <CardHeader title="Connections" />
        <div className="p-5 flex flex-col gap-2">
          <p className="text-text-2 text-sm">
            Manage linked institutions, reconnect broken items, or disconnect a single account from{" "}
            <Link href="/accounts" className="text-brand">
              Accounts &amp; connections
            </Link>
            .
          </p>
        </div>
      </Card>

      <Card>
        <CardHeader title="Rules" />
        <div className="p-5 flex flex-col gap-2">
          <p className="text-text-2 text-sm">
            Categorization rules live on their own screen, with a live preview count before applying to existing
            transactions.
          </p>
          <Link href="/rules" className="text-brand text-sm w-fit">
            Manage rules →
          </Link>
        </div>
      </Card>

      <Card>
        <CardHeader title="Export" />
        <div className="p-5 flex flex-col gap-3">
          <p className="text-text-2 text-sm">Download every transaction you have — useful for backups or moving your data elsewhere.</p>
          <div className="flex gap-3">
            <a href="/api/export?format=csv" className="h-9 px-3 inline-flex items-center rounded-control bg-surface border border-border-strong text-sm font-medium text-text hover:bg-sunken">
              Download CSV
            </a>
            <a href="/api/export?format=json" className="h-9 px-3 inline-flex items-center rounded-control bg-surface border border-border-strong text-sm font-medium text-text hover:bg-sunken">
              Download JSON
            </a>
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader title="Categories, Notifications" />
        <div className="p-5">
          <p className="text-text-2 text-sm">
            Categories can be renamed inline from any transaction; a dedicated management screen (merge, hide,
            reorder) and notification digests are scoped in WORK.md §7.1/§8.4 but not yet built.
          </p>
        </div>
      </Card>

      <Card className="border-negative">
        <CardHeader title="Danger zone" />
        <div className="p-5">
          <DangerZone itemCount={items.length} />
        </div>
      </Card>
    </div>
  );
}
