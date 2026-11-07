import Link from "next/link";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireUserId } from "@/lib/session";
import { safeToSpendSettingsFor } from "@/lib/safeToSpend";
import { APP_VERSION } from "@/lib/version";
import { NewSubNav } from "@/components/new/NewNav";
import { CountedAccounts, CushionSetting, DailySpendSetting, HideAmountsSetting, NewUiSetting, RecapsSetting } from "@/components/new/SettingsControls";

export default async function NewSettingsPage() {
  const userId = await requireUserId();
  const [[user], sts] = await Promise.all([
    db
      .select({ name: schema.users.name, email: schema.users.email, recaps: schema.users.recapsEnabled, daily: schema.users.forecastDailySpendCents, newUiAt: schema.users.newUiAt, timezone: schema.users.timezone })
      .from(schema.users)
      .where(eq(schema.users.id, userId))
      .limit(1),
    safeToSpendSettingsFor(userId),
  ]);

  return (
    <main className="tn-main" style={{ maxWidth: 860 }}>
      <NewSubNav section="settings" />

      <section>
        <h1 className="tn-disp" style={{ margin: "0 0 4px", fontSize: "clamp(32px, 4vw, 40px)", fontWeight: 700 }}>
          Settings
        </h1>
        <p className="tn-muted" style={{ margin: 0 }}>
          {user?.name ? `${user.name} · ` : ""}
          {user?.email}
          {user?.timezone ? ` · ${user.timezone}` : ""}
        </p>
      </section>

      <section>
        <h2 className="tn-h2" style={{ marginBottom: 4 }}>
          Tally
        </h2>
        <NewUiSetting on={user?.newUiAt != null} />
        <HideAmountsSetting />
        <RecapsSetting on={user?.recaps ?? false} />
      </section>

      <section>
        <h2 className="tn-h2" style={{ marginBottom: 4 }}>
          Looking ahead
        </h2>
        <p className="tn-muted" style={{ margin: "0 0 8px", fontSize: 14 }}>
          These shape &quot;Spend freely today&quot;, &quot;Can I afford it?&quot; and Forecast.
        </p>
        <CushionSetting cushion={sts.cushion} />
        <DailySpendSetting cents={user?.daily ?? null} />
      </section>

      {sts.accounts.length > 0 && (
        <section>
          <h2 className="tn-h2" style={{ marginBottom: 4 }}>
            Spendable cash
          </h2>
          <p className="tn-muted" style={{ margin: "0 0 8px", fontSize: 14 }}>
            Which bank accounts count as money you can spend. Savings are left out unless you turn them on.
          </p>
          <CountedAccounts accounts={sts.accounts} />
        </section>
      )}

      <section className="tn-card-line" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <h2 className="tn-h2" style={{ fontSize: 18 }}>
          Everything else
        </h2>
        <p className="tn-muted" style={{ margin: 0, fontSize: 14 }}>
          Your pay schedule, alerts, password and email, API keys, exporting your data and deleting your account live in the full settings for now.
        </p>
        <Link href="/settings" className="tn-btn tn-btn-sm" style={{ alignSelf: "flex-start" }}>
          Open full settings
        </Link>
      </section>

      <p className="tn-faint" style={{ margin: 0, fontSize: 13 }}>
        Tally {APP_VERSION} · <Link href="/settings/changelog">What&apos;s new</Link>
      </p>
    </main>
  );
}
