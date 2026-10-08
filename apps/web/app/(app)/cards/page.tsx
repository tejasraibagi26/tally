import Link from "next/link";
import { CreditCard as CreditCardIcon } from "lucide-react";
import { requireUserId } from "@/lib/session";
import { accountDisplayName } from "@tally/core/accountName";
import { cardSortRank, nextPayment } from "@tally/core/cardView";
import { creditCardsForUser, institutionBrands, utilizationFor, viewForCard } from "@/lib/liabilities";
import { todayFor } from "@/lib/userTimezone";
import { Card } from "@/components/ui/Card";
import { PageHeader, SyncFreshness } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { SyncButton } from "@/components/plaid/SyncButton";
import { SyncFailureBanner } from "@/components/plaid/SyncFailureBanner";
import { CardsView, type CardItem } from "@/components/cards/CardsView";

const NEEDS_FIX = new Set(["login_required", "error", "revoked", "pending_expiration"]);

/**
 * Credit cards (DESIGN.md §10.6): what you owe, the next payment, credit
 * used, then one flat table of cards sorted by what needs you, with a side
 * panel per card. Paid / due / overdue comes from @tally/core/cardView,
 * counting payments found in the card's own transactions since the
 * statement closed.
 */
export default async function CardsPage() {
  const userId = await requireUserId();
  const [rows, today] = await Promise.all([creditCardsForUser(userId), todayFor(userId)]);

  if (rows.length === 0) {
    return (
      <div className="max-w-[1280px] mx-auto px-4 lg:px-8 py-5 lg:py-7 flex flex-col gap-6">
        <PageHeader title="Credit cards" />
        <Card className="p-10">
          <EmptyState
            icon={CreditCardIcon}
            title="No credit cards yet"
            description="Connect a card and its balance, statement and due date show up here."
            action={
              <Link href="/accounts" className="text-brand text-[13.5px] font-medium">
                Connect a card →
              </Link>
            }
          />
        </Card>
      </div>
    );
  }

  const [brands, utilization] = await Promise.all([institutionBrands(rows), utilizationFor(rows)]);
  const cards: CardItem[] = rows
    .map((c) => {
      const brand = c.institutionId ? brands[c.institutionId] : undefined;
      const l = c.liability;
      return {
        accountId: c.accountId,
        name: c.name,
        nickname: c.nickname,
        displayName: accountDisplayName(c.name, c.nickname),
        mask: c.mask,
        bankName: brand?.name ?? c.institutionName ?? "Card",
        color: brand?.color ?? null,
        logo: brand?.logo ?? null,
        network: c.network,
        balance: c.currentBalance,
        limit: c.creditLimit,
        limitIsManual: c.creditLimitIsManual,
        view: viewForCard(c, today),
        statementDate: l?.lastStatementIssueDate ?? null,
        statementBalance: l?.lastStatementBalance ?? null,
        minimum: l?.minimumPaymentAmount ?? null,
        dueDate: l?.nextPaymentDueDate ?? null,
        aprs: (l?.aprs as { apr_percentage: number; apr_type: string }[] | null) ?? [],
        hasLiability: !!l,
        itemId: c.itemId,
        needsFix: !!c.connectionStatus && NEEDS_FIX.has(c.connectionStatus),
        asOf: c.lastSyncedAt ? new Date(c.lastSyncedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : null,
      };
    })
    .sort((a, b) => cardSortRank(a.view) - cardSortRank(b.view) || (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999") || a.displayName.localeCompare(b.displayName));

  const totalOwed = cards.reduce((sum, c) => sum + Math.max(0, c.balance), 0);
  const next = nextPayment(cards);

  return (
    <div className="max-w-[1280px] mx-auto px-4 lg:px-8 py-5 lg:py-7 flex flex-col gap-6">
      <PageHeader
        title="Credit cards"
        meta={[`${cards.length} card${cards.length === 1 ? "" : "s"}`, rows.some((r) => r.lastSyncedAt) && <SyncFreshness key="sync" syncedAt={rows.map((r) => r.lastSyncedAt)} />]}
        actions={<SyncButton products={["liabilities"]} label="Sync card details" />}
      />
      <SyncFailureBanner />
      <CardsView cards={cards} totalOwed={totalOwed} next={next} utilization={utilization} />
      <p className="m-0 text-[12px] text-text-3">Statement and payment details come from your bank once a day. Payments you make show up as soon as their transaction syncs.</p>
    </div>
  );
}
