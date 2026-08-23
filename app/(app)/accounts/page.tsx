import { db, schema } from "@/db";
import { eq } from "drizzle-orm";
import { Landmark } from "lucide-react";
import { requireUserId } from "@/lib/session";
import { formatCents } from "@/lib/money";
import { Card } from "@/components/ui/Card";
import { StatusBadge, type Status } from "@/components/ui/StatusBadge";
import { EmptyState } from "@/components/ui/EmptyState";
import { LinkButton } from "@/components/plaid/LinkButton";
import { DeleteItemButton } from "@/components/plaid/DeleteItemButton";
import { MOCK_MODE } from "@/lib/config";
import { freshnessStatus } from "@/lib/freshness";

// A broken item (needs re-auth) always reads "Broken" regardless of how
// recently it last synced — otherwise the freshness badge follows §8.3.
function itemStatusToBadge(status: string, lastSyncedAt: Date | null): Status {
  if (status === "login_required" || status === "revoked" || status === "error") return "critical";
  if (status === "pending_expiration") return "warning";
  return freshnessStatus(lastSyncedAt);
}

function relativeTime(date: Date | null): string {
  if (!date) return "Never synced";
  const diffMs = Date.now() - date.getTime();
  const hours = Math.floor(diffMs / 3_600_000);
  if (hours < 1) return "Updated just now";
  if (hours < 24) return `Updated ${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `Updated ${days}d ago`;
}

export default async function AccountsPage() {
  const userId = await requireUserId();

  const items = await db.query.plaidItems.findMany({
    where: eq(schema.plaidItems.userId, userId),
  });

  const accounts = await db.query.accounts.findMany({
    where: eq(schema.accounts.userId, userId),
  });

  const accountsByItem = new Map<string, typeof accounts>();
  for (const acct of accounts) {
    if (!acct.itemId) continue;
    accountsByItem.set(acct.itemId, [...(accountsByItem.get(acct.itemId) ?? []), acct]);
  }

  const totalAssets = accounts
    .filter((a) => a.type === "depository" || a.type === "investment")
    .reduce((sum, a) => sum + (a.currentBalance ?? 0), 0);
  const totalLiabilities = accounts
    .filter((a) => a.type === "credit" || a.type === "loan")
    .reduce((sum, a) => sum + (a.currentBalance ?? 0), 0);

  return (
    <div className="max-w-[1280px] mx-auto px-4 lg:px-8 py-5 lg:py-7 flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-baseline gap-3">
          <h1 className="text-2xl font-semibold text-text">Accounts &amp; connections</h1>
          <span className="text-[13.5px] text-text-3">
            {accounts.length} account{accounts.length === 1 ? "" : "s"} · {items.length} institution
            {items.length === 1 ? "" : "s"}
          </span>
        </div>
        <LinkButton mode="create" label="Add account" mock={MOCK_MODE} />
      </div>

      {items.length > 0 && (
        <Card className="flex flex-col sm:flex-row">
          <div className="flex-1 p-[18px_24px] border-b sm:border-b-0 sm:border-r border-border flex flex-col gap-2">
            <span className="text-xs font-medium uppercase tracking-wide text-text-3">Assets</span>
            <span className="font-display text-3xl text-positive tabular">{formatCents(totalAssets)}</span>
          </div>
          <div className="flex-1 p-[18px_24px] border-b sm:border-b-0 sm:border-r border-border flex flex-col gap-2">
            <span className="text-xs font-medium uppercase tracking-wide text-text-3">Liabilities</span>
            <span className="font-display text-3xl text-negative tabular">{formatCents(totalLiabilities)}</span>
          </div>
          <div className="flex-1 p-[18px_24px] flex flex-col gap-2">
            <span className="text-xs font-medium uppercase tracking-wide text-text-3">Net</span>
            <span className="font-display text-3xl text-text tabular">
              {formatCents(totalAssets - totalLiabilities)}
            </span>
          </div>
        </Card>
      )}

      {items.length === 0 ? (
        <Card className="p-10">
          <EmptyState
            icon={Landmark}
            title="No accounts yet"
            description="Connect your bank, card, or brokerage to see everything in one place."
            action={<LinkButton mode="create" label="Connect your first account" mock={MOCK_MODE} />}
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
          {items.map((item) => {
            const itemAccounts = accountsByItem.get(item.id) ?? [];
            const broken = item.status === "login_required" || item.status === "revoked" || item.status === "error";
            const total = itemAccounts.reduce((sum, a) => sum + (a.currentBalance ?? 0), 0);

            return (
              <Card key={item.id} className={broken ? "border-negative" : undefined}>
                <div className="flex items-center gap-3 p-4 border-b border-border">
                  <span className="w-[34px] h-[34px] flex-none rounded-[9px] bg-brand-subtle text-brand flex items-center justify-center font-medium text-sm">
                    {(item.institutionName ?? "?").slice(0, 2).toUpperCase()}
                  </span>
                  <div className="flex flex-col gap-1 flex-1 min-w-0">
                    <span className="font-semibold text-base text-text">
                      {item.institutionName ?? "Unknown institution"}
                    </span>
                    <span className="font-mono text-xs text-text-3">{relativeTime(item.lastSyncedAt)}</span>
                  </div>
                  <StatusBadge status={itemStatusToBadge(item.status, item.lastSyncedAt)} />
                  <DeleteItemButton itemId={item.id} />
                </div>

                {broken && (
                  <div className="flex items-center gap-3 px-4 py-3.5 bg-negative-subtle border-b border-border">
                    <span className="flex-1 text-[15px] leading-snug text-text">
                      ▲ Login expired. Balances and transactions are frozen until you reconnect.
                    </span>
                    <LinkButton mode="update" itemId={item.id} label="Reconnect" variant="primary" />
                  </div>
                )}

                {itemAccounts.map((acct) => (
                  <div
                    key={acct.id}
                    className="grid grid-cols-[1fr_auto] gap-4 items-center px-4 py-3 border-b border-border last:border-b-0"
                  >
                    <div className="flex flex-col gap-1 min-w-0">
                      <span className="text-[15px] text-text">{acct.name}</span>
                      <span className="font-mono text-xs text-text-3">
                        {acct.subtype ?? acct.type} ····{acct.mask ?? "----"}
                      </span>
                    </div>
                    <div className="flex flex-col gap-1 text-right">
                      <span className="text-[17px] text-text tabular">
                        {acct.currentBalance != null ? formatCents(acct.currentBalance) : "—"}
                      </span>
                      {acct.type === "credit" && acct.creditLimit != null && (
                        <span className="text-xs text-text-3 tabular">of {formatCents(acct.creditLimit)}</span>
                      )}
                    </div>
                  </div>
                ))}

                <div className="flex items-center justify-between px-4 py-3 text-[13.5px]">
                  <span className="text-brand">View transactions →</span>
                  <span className="text-text-3 tabular">{formatCents(total)}</span>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
