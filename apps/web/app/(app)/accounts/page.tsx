import { db, schema } from "@/db";
import { isLiveAccountRow } from "@/lib/liveAccounts";
import { DisconnectedBanks, type DisconnectedBank } from "@/components/accounts/DisconnectedBanks";
import { desc, eq, inArray } from "drizzle-orm";
import { Check, Landmark } from "lucide-react";
import { requireUserId } from "@/lib/session";
import { formatCents } from "@tally/core/money";
import { connectionState, type ConnectionLevel } from "@tally/core/connectionState";
import { accountDisplayName } from "@tally/core/accountName";
import { Card } from "@/components/ui/Card";
import { PageHeader, SyncFreshness } from "@/components/ui/PageHeader";
import { LinkButton } from "@/components/plaid/LinkButton";
import { SyncButton } from "@/components/plaid/SyncButton";
import { SyncFailureBanner } from "@/components/plaid/SyncFailureBanner";
import { SyncFailureToast } from "@/components/plaid/SyncFailureToast";
import { AccountsView } from "@/components/accounts/AccountsView";
import { ConnectionHealth, type HealthLevel } from "@/components/accounts/ConnectionHealth";
import type { ConnectionView } from "@/components/accounts/types";
import { MOCK_MODE } from "@/lib/config";
import { itemStatusToBadge } from "@/lib/freshness";
import { toNetWorthCurrency, NET_WORTH_CURRENCY } from "@tally/core/fx";

/** Sync history rows kept per bank for its side panel. */
const RUNS_PER_ITEM = 10;

export default async function AccountsPage({ searchParams }: { searchParams: Promise<{ bank?: string }> }) {
  const userId = await requireUserId();
  const { bank } = await searchParams;

  const [allItems, allAccounts] = await Promise.all([
    db.query.plaidItems.findMany({ where: eq(schema.plaidItems.userId, userId) }),
    db.query.accounts.findMany({ where: eq(schema.accounts.userId, userId) }),
  ]);
  // Banks the user disconnected keep their history but sit apart from the
  // live ones, out of the totals and health (lib/liveAccounts.ts).
  const items = allItems.filter((i) => !i.disconnectedAt);
  const disconnectedItems = allItems.filter((i) => i.disconnectedAt).sort((a, b) => b.disconnectedAt!.getTime() - a.disconnectedAt!.getTime());
  const disconnectedIds = new Set(disconnectedItems.map((i) => i.id));
  const accounts = allAccounts.filter((a) => isLiveAccountRow(a, disconnectedIds));
  const disconnected: DisconnectedBank[] = disconnectedItems.map((item) => ({
    id: item.id,
    institutionName: item.institutionName,
    disconnectedAt: item.disconnectedAt!.toISOString(),
    accounts: allAccounts
      .filter((a) => a.itemId === item.id)
      .map((a) => ({ id: a.id, name: accountDisplayName(a.name, a.nickname), mask: a.mask })),
  }));

  // Newest first across all of the user's items, then trimmed per item below.
  const runs =
    items.length === 0
      ? []
      : await db
          .select()
          .from(schema.syncRuns)
          .where(inArray(schema.syncRuns.itemId, items.map((i) => i.id)))
          .orderBy(desc(schema.syncRuns.startedAt))
          .limit(items.length * RUNS_PER_ITEM * 3);

  const accountsByItem = new Map<string, typeof accounts>();
  for (const acct of accounts) {
    if (!acct.itemId) continue;
    accountsByItem.set(acct.itemId, [...(accountsByItem.get(acct.itemId) ?? []), acct]);
  }

  // Per-connection/per-account balances stay labeled in their own currency,
  // unconverted -- but totals mix every account together, so they're
  // converted to NET_WORTH_CURRENCY first (lib/fx.ts) rather than summing raw
  // USD and CAD cents as if they were the same currency.
  const convertedForTotals = await Promise.all(
    accounts.map(async (a) => (a.currentBalance != null ? await toNetWorthCurrency(a.currentBalance, a.currency) : 0)),
  );
  const convertedById = new Map(accounts.map((a, i) => [a.id, convertedForTotals[i]!]));
  const isDebt = (a: (typeof accounts)[number]) => a.type === "credit" || a.type === "loan";
  const totalAssets = accounts.reduce((sum, a, i) => (a.type === "depository" || a.type === "investment" ? sum + convertedForTotals[i]! : sum), 0);
  const totalLiabilities = accounts.reduce((sum, a, i) => (isDebt(a) ? sum + convertedForTotals[i]! : sum), 0);

  const views: ConnectionView[] = items.map((item) => {
    const itemAccounts = accountsByItem.get(item.id) ?? [];
    return {
      id: item.id,
      institutionName: item.institutionName,
      status: item.status,
      lastSyncedAt: item.lastSyncedAt?.toISOString() ?? null,
      badge: itemStatusToBadge(item.status, item.lastSyncedAt, item.transactionsUpdateStatus),
      createdAt: item.createdAt.toISOString(),
      // currentBalance is stored positive for every type -- a card's or
      // loan's balance is what's owed -- so debts are subtracted here.
      total: itemAccounts.reduce((sum, a) => sum + (isDebt(a) ? -1 : 1) * (convertedById.get(a.id) ?? 0), 0),
      accounts: itemAccounts.map((a) => ({
        id: a.id,
        name: accountDisplayName(a.name, a.nickname),
        realName: a.name,
        nickname: a.nickname,
        mask: a.mask,
        type: a.type,
        subtype: a.subtype,
        currentBalance: a.currentBalance,
        currency: a.currency,
        creditLimit: a.creditLimit,
      })),
      runs: runs
        .filter((r) => r.itemId === item.id)
        .slice(0, RUNS_PER_ITEM)
        .map((r) => ({
          id: r.id,
          kind: r.kind,
          trigger: r.trigger,
          startedAt: r.startedAt.toISOString(),
          finishedAt: r.finishedAt?.toISOString() ?? null,
          added: r.added,
          modified: r.modified,
          removed: r.removed,
          error: r.error,
        })),
    };
  });

  // "A manual retry already failed" -> the state escalates to Sign in again.
  const serverRefreshFailed = views.filter((v) => v.runs.find((r) => r.trigger === "manual")?.error).map((v) => v.id);

  // Server-side health for the summary meter and header (no in-flight local state here).
  const levels = views.map((v) => connectionState(v, { refreshing: false, linking: false, justReconnected: false, refreshFailed: serverRefreshFailed.includes(v.id) }));
  const count = (pred: (l: ConnectionLevel, needs: boolean) => boolean) => levels.filter((s) => pred(s.level, s.needsAttention)).length;
  const blocked = count((l) => l === "blocked");
  const actSoon = count((l, needs) => needs && l !== "blocked");
  // One tally stroke per bank in the summary, most urgent first (the cards' own order).
  const healthBanks = views
    .map((v, i) => ({
      name: v.institutionName ?? "A bank",
      level: (levels[i]!.level === "blocked" ? "blocked" : levels[i]!.needsAttention ? "act" : "healthy") as HealthLevel,
      rank: levels[i]!.rank,
    }))
    .sort((a, b) => a.rank - b.rank || a.name.localeCompare(b.name));

  return (
    <div className="max-w-[1280px] mx-auto px-4 lg:px-8 py-5 lg:py-7 flex flex-col gap-6">
      <PageHeader
        title="Accounts & connections"
        meta={[
          `${accounts.length} account${accounts.length === 1 ? "" : "s"}`,
          items.length > 0 && `${items.length} bank${items.length === 1 ? "" : "s"}`,
          items.some((i) => i.lastSyncedAt) && <SyncFreshness key="sync" syncedAt={items.map((i) => i.lastSyncedAt)} />,
          blocked + actSoon > 0 && (
            <span key="needs" className={blocked > 0 ? "text-negative" : "text-warning"}>
              {blocked + actSoon} need{blocked + actSoon === 1 ? "s" : ""} you
            </span>
          ),
        ]}
        actions={
          items.length > 0 && (
            <>
              <SyncButton products={["balances"]} label="Sync all" />
              <LinkButton mode="create" label="Add bank" mock={MOCK_MODE} />
            </>
          )
        }
      />

      <SyncFailureBanner />
      <SyncFailureToast />

      {items.length === 0 ? (
        <Card className="p-8 lg:p-10 flex flex-col items-start gap-4 max-w-[640px]">
          <span className="w-11 h-11 rounded-[12px] bg-brand-subtle text-brand flex items-center justify-center">
            <Landmark size={20} strokeWidth={1.75} />
          </span>
          <h2 className="m-0 font-display text-[28px] font-normal text-text">Connect your first bank</h2>
          <p className="m-0 text-[15px] leading-relaxed text-text-2 max-w-[52ch]">
            Tally reads your balances and transactions so budgets, bills and net worth fill themselves in.
          </p>
          <ul className="m-0 p-0 list-none flex flex-col gap-2 text-[14px] text-text-2">
            {["Read-only. Tally can't move money", "Secured by Plaid. Your password stays with your bank", "Disconnect any bank at any time"].map((t) => (
              <li key={t} className="flex items-center gap-2">
                <Check size={15} className="text-brand flex-none" /> {t}
              </li>
            ))}
          </ul>
          <LinkButton mode="create" label="Connect a bank" mock={MOCK_MODE} />
        </Card>
      ) : (
        <>
          {/* gap-px over a border-colored ground draws the dividers, so they stay
              single lines however the four cells wrap (1, 2 or 4 columns). */}
          <Card className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[1.2fr_1fr_1fr_1.4fr] gap-px bg-border overflow-hidden">
            <Figure label={`Net worth (${NET_WORTH_CURRENCY})`} value={formatCents(totalAssets - totalLiabilities)} />
            <Figure label="Assets" value={formatCents(totalAssets)} className="text-positive" />
            <Figure label="Debts" value={formatCents(totalLiabilities)} className="text-negative" />
            <ConnectionHealth banks={healthBanks} />
          </Card>

          <AccountsView items={views} baseCurrency={NET_WORTH_CURRENCY} initialBankId={bank ?? null} serverRefreshFailed={serverRefreshFailed} />
        </>
      )}

      {disconnected.length > 0 && <DisconnectedBanks banks={disconnected} mock={MOCK_MODE} />}
    </div>
  );
}

function Figure({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className="bg-surface p-[18px_24px] flex flex-col gap-2">
      <span className="text-xs font-medium uppercase tracking-wide text-text-3">{label}</span>
      <span className={`font-display text-3xl tabular money ${className ?? "text-text"}`}>{value}</span>
    </div>
  );
}
