import Link from "next/link";
import { eq } from "drizzle-orm";
import { User, Lock, Download, Link2, Wand2, ChevronRight, AlertTriangle, type LucideIcon } from "lucide-react";
import { db, schema } from "@/db";
import { requireUserId } from "@/lib/session";
import { Card, CardHeader } from "@/components/ui/Card";
import { AccountForm } from "@/components/settings/AccountForm";
import { PasswordForm } from "@/components/settings/PasswordForm";
import { DangerZone } from "@/components/settings/DangerZone";

function GroupLabel({ children }: { children: string }) {
  return <div className="text-xs font-medium uppercase tracking-[0.06em] text-text-3 px-1">{children}</div>;
}

function LinkRow({
  icon: Icon,
  title,
  description,
  href,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  href: string;
}) {
  return (
    <Link href={href} className="flex items-center gap-3 px-5 py-4 hover:bg-sunken transition-colors">
      <div className="w-8 h-8 rounded-full bg-brand-subtle flex items-center justify-center flex-none">
        <Icon size={15} strokeWidth={1.75} className="text-brand" />
      </div>
      <div className="flex flex-col gap-0.5 min-w-0 flex-1">
        <span className="text-[15px] font-medium text-text">{title}</span>
        <span className="text-[13.5px] text-text-2 truncate">{description}</span>
      </div>
      <ChevronRight size={16} strokeWidth={1.75} className="text-text-3 flex-none" />
    </Link>
  );
}

export default async function SettingsPage() {
  const userId = await requireUserId();

  const [user] = await db.select().from(schema.users).where(eq(schema.users.id, userId)).limit(1);
  const items = await db.select({ id: schema.plaidItems.id }).from(schema.plaidItems).where(eq(schema.plaidItems.userId, userId));

  return (
    <div className="max-w-[720px] mx-auto px-4 lg:px-8 py-5 lg:py-7 flex flex-col gap-8">
      <h1 className="text-2xl font-semibold text-text">Settings</h1>

      <div className="flex flex-col gap-3">
        <GroupLabel>Profile</GroupLabel>
        <Card>
          <CardHeader title="Account" action={<User size={17} strokeWidth={1.75} className="text-text-3" />} />
          <div className="p-5">
            <AccountForm initialName={user?.name ?? ""} initialEmail={user?.email ?? ""} />
          </div>
        </Card>
        <Card>
          <CardHeader title="Password" action={<Lock size={17} strokeWidth={1.75} className="text-text-3" />} />
          <div className="p-5">
            <PasswordForm />
          </div>
        </Card>
      </div>

      <div className="flex flex-col gap-3">
        <GroupLabel>Data</GroupLabel>
        <Card>
          <CardHeader title="Export" action={<Download size={17} strokeWidth={1.75} className="text-text-3" />} />
          <div className="p-5 flex flex-col gap-3">
            <p className="text-text-2 text-sm">Download every transaction you have. Useful for backups or moving your data elsewhere.</p>
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
        <Card className="divide-y divide-border">
          <LinkRow
            icon={Link2}
            title="Accounts & connections"
            description="Manage linked institutions, reconnect or disconnect an account"
            href="/accounts"
          />
          <LinkRow
            icon={Wand2}
            title="Categorization rules"
            description="Auto-categorize transactions as they come in"
            href="/rules"
          />
        </Card>
      </div>

      <div className="flex flex-col gap-3">
        <GroupLabel>Danger zone</GroupLabel>
        <Card className="border-negative">
          <CardHeader title="Wipe all data" action={<AlertTriangle size={17} strokeWidth={1.75} className="text-negative" />} />
          <div className="p-5">
            <DangerZone itemCount={items.length} />
          </div>
        </Card>
      </div>
    </div>
  );
}
