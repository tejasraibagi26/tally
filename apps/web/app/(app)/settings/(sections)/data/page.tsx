import { desc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireUserId } from "@/lib/session";
import { SettingsBlock, SettingsGroup, SettingsRow } from "@/components/settings/SettingsLayout";
import { ApiKeysManager } from "@/components/settings/ApiKeysManager";

const exportButton =
  "h-[30px] px-3 inline-flex items-center rounded-control bg-surface border border-border-strong text-sm font-medium text-text hover:bg-sunken focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-info";

// Settings → Data & developer: export, and API tokens for automations.
export default async function DataSettingsPage() {
  const userId = await requireUserId();
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

  return (
    <>
      <SettingsGroup id="data" title="Export">
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
    </>
  );
}
