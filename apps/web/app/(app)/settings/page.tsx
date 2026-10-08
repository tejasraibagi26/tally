import { and, desc, eq, isNull, or } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireUserId } from "@/lib/session";
import { PageHeader } from "@/components/ui/PageHeader";
import { ProfileSection } from "@/components/settings/ProfileSection";
import { DangerZone } from "@/components/settings/DangerZone";
import { IncomeScheduleManager } from "@/components/settings/IncomeScheduleManager";
import { AlertSettings } from "@/components/settings/AlertSettings";
import { SettingsBlock, SettingsGroup, SettingsRow } from "@/components/settings/SettingsLayout";
import { SettingsNav, type SettingsNavItem } from "@/components/settings/SettingsNav";
import { loadAlertPreferences } from "@/lib/alerts/preferences";
import { alertHistory } from "@/lib/alerts/history";
import { ApiKeysManager } from "@/components/settings/ApiKeysManager";
import { accountDisplayName } from "@tally/core/accountName";
import { APP_VERSION } from "@/lib/version";
import Link from "next/link";

const SECTIONS: SettingsNavItem[] = [
  { id: "profile", label: "Profile" },
  { id: "security", label: "Security" },
  { id: "alerts", label: "Notifications" },
  { id: "income", label: "Income" },
  { id: "data", label: "Data" },
  { id: "developer", label: "Developer" },
  { id: "delete", label: "Delete data", tone: "negative" },
];

const exportButton =
  "h-[30px] px-3 inline-flex items-center rounded-control bg-surface border border-border-strong text-sm font-medium text-text hover:bg-sunken focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-info";

export default async function SettingsPage() {
  const userId = await requireUserId();

  const [user] = await db.select().from(schema.users).where(eq(schema.users.id, userId)).limit(1);
  const items = await db.select({ id: schema.plaidItems.id }).from(schema.plaidItems).where(eq(schema.plaidItems.userId, userId));

  const accountRows = await db
    .select({ id: schema.accounts.id, name: schema.accounts.name, nickname: schema.accounts.nickname, mask: schema.accounts.mask })
    .from(schema.accounts)
    .where(eq(schema.accounts.userId, userId));
  const accounts = accountRows.map((a) => ({ id: a.id, name: accountDisplayName(a.name, a.nickname), mask: a.mask }));
  const incomeCategories = await db
    .select({ id: schema.categories.id, name: schema.categories.name })
    .from(schema.categories)
    .where(and(eq(schema.categories.kind, "income"), or(isNull(schema.categories.userId), eq(schema.categories.userId, userId))));
  const incomeSchedules = await db
    .select({
      id: schema.incomeSchedules.id,
      accountId: schema.incomeSchedules.accountId,
      categoryId: schema.incomeSchedules.categoryId,
      label: schema.incomeSchedules.label,
      amount: schema.incomeSchedules.amount,
      dayAnchors: schema.incomeSchedules.dayAnchors,
      active: schema.incomeSchedules.active,
      accountName: schema.accounts.name,
      accountNickname: schema.accounts.nickname,
      accountMask: schema.accounts.mask,
      categoryName: schema.categories.name,
    })
    .from(schema.incomeSchedules)
    .leftJoin(schema.accounts, eq(schema.incomeSchedules.accountId, schema.accounts.id))
    .leftJoin(schema.categories, eq(schema.incomeSchedules.categoryId, schema.categories.id))
    .where(eq(schema.incomeSchedules.userId, userId));
  const incomeSchedulesForDisplay = incomeSchedules.map(({ accountNickname, ...s }) => ({
    ...s,
    accountName: s.accountName != null ? accountDisplayName(s.accountName, accountNickname) : s.accountName,
  }));

  const [{ prefs: alertPrefs }, recentAlerts] = await Promise.all([loadAlertPreferences(userId), alertHistory(userId, 10)]);

  const apiKeys = await db
    .select({
      id: schema.apiKeys.id,
      name: schema.apiKeys.name,
      keyPrefix: schema.apiKeys.keyPrefix,
      lastUsedAt: schema.apiKeys.lastUsedAt,
      createdAt: schema.apiKeys.createdAt,
    })
    .from(schema.apiKeys)
    .where(eq(schema.apiKeys.userId, userId))
    .orderBy(desc(schema.apiKeys.createdAt));
  const apiKeysForDisplay = apiKeys.map((k) => ({
    ...k,
    lastUsedAt: k.lastUsedAt?.toISOString() ?? null,
    createdAt: k.createdAt.toISOString(),
  }));
  // APP_URL is the canonical host (see app/api/cron/monthly-recap/route.ts
  // for the same convention) -- falls back to the deployment's own preview
  // hostname, then localhost, so this never renders a bare relative path
  // someone would have to guess a host for.
  const appHost = process.env.APP_URL ?? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");
  const shortcutsEndpoint = `${appHost.replace(/\/$/, "")}/api/shortcuts/transactions`;

  // Rows that show their value, edits in dialogs, a sticky section menu
  // beside them from 1024px (which hides below that; sections just stack).
  return (
    <div className="max-w-[1040px] mx-auto px-4 lg:px-8 py-5 lg:py-7 flex flex-col gap-6">
      <PageHeader title="Settings" />

      <div className="grid grid-cols-1 lg:grid-cols-[180px_minmax(0,1fr)] gap-8 items-start">
        <div className="hidden lg:block self-stretch">
          <SettingsNav items={SECTIONS} version={APP_VERSION} />
        </div>

        <div className="flex flex-col gap-8 min-w-0 max-w-[720px]">
          <ProfileSection name={user?.name ?? ""} email={user?.email ?? ""} birthDate={user?.birthDate ?? null} />

          <AlertSettings initial={alertPrefs} history={recentAlerts} recapsEnabled={user?.recapsEnabled ?? true} />

          <SettingsGroup
            id="income"
            title="Income"
            description="For a paycheck your bank doesn't sync reliably: set the amount and pay days once, and Tally adds it on every payday."
          >
            <SettingsBlock>
              <IncomeScheduleManager accounts={accounts} categories={incomeCategories} schedules={incomeSchedulesForDisplay} />
            </SettingsBlock>
          </SettingsGroup>

          <SettingsGroup id="data" title="Data">
            <SettingsRow title="Export transactions" description="Every transaction you have, for backups or moving your data elsewhere">
              <a href="/api/export?format=csv" className={exportButton}>
                CSV
              </a>
              <a href="/api/export?format=json" className={exportButton}>
                JSON
              </a>
            </SettingsRow>
          </SettingsGroup>

          <SettingsGroup id="developer" title="Developer" description="For automations like Apple Shortcuts: create a token, then have your automation send it a transaction.">
            <SettingsBlock>
              <ApiKeysManager apiKeys={apiKeysForDisplay} shortcutsEndpoint={shortcutsEndpoint} />
            </SettingsBlock>
          </SettingsGroup>

          <DangerZone itemCount={items.length} />

          <Link href="/settings/changelog" className="lg:hidden self-center font-mono text-[12px] text-text-3 hover:text-text-2 transition-colors">
            v{APP_VERSION} · Changelog
          </Link>
        </div>
      </div>
    </div>
  );
}
