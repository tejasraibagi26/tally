import { accountDisplayName } from "@tally/core/accountName";
import { cardSortRank, nextPayment, type CardView } from "@tally/core/cardView";
import type { CreditCardSummary, InstitutionBrand } from "@/lib/queries/liabilities";

const NEEDS_FIX = new Set(["login_required", "error", "revoked", "pending_expiration"]);

export interface CardRowData {
  card: CreditCardSummary;
  view: CardView;
  displayName: string;
  bankName: string;
  color: string | null;
  logo: string | null;
  dueDate: string | null;
  needsFix: boolean;
}

/** The cards with their brand and cycle view, sorted by what needs you (same order as web). */
export function cardRows(cards: CreditCardSummary[], institutions: Record<string, InstitutionBrand> | undefined): CardRowData[] {
  return cards
    .filter((c): c is CreditCardSummary & { view: CardView } => !!c.view)
    .map((c) => {
      const brand = c.institutionId ? institutions?.[c.institutionId] : undefined;
      return {
        card: c,
        view: c.view,
        displayName: accountDisplayName(c.name, c.nickname),
        bankName: brand?.name ?? c.institutionName ?? "Card",
        color: brand?.color ?? null,
        logo: brand?.logo ?? null,
        dueDate: c.liability?.nextPaymentDueDate ?? null,
        needsFix: !!c.connectionStatus && NEEDS_FIX.has(c.connectionStatus),
      };
    })
    .sort((a, b) => cardSortRank(a.view) - cardSortRank(b.view) || (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999") || a.displayName.localeCompare(b.displayName));
}

export { nextPayment };

export function shortDate(d: string): string {
  return new Date(`${d}T00:00:00Z`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
}
