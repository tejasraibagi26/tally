import { useMemo } from "react";
import { rollUpPositions, type Position } from "@tally/core/investments";
import { ago, connectionState, type ConnectionState } from "@tally/core/connectionState";
import { useHoldings, useInvestmentHistory, useInvestmentTransactions } from "@/lib/queries/investments";
import { useAccounts, type Institution } from "@/lib/queries/accounts";
import { useItemRefreshStates } from "@/lib/queries/plaid";

export interface StaleConnection {
  institution: Institution;
  state: ConnectionState;
  accountNames: string[];
  value: number;
}

/**
 * Everything the Investments screens read, joined once: holdings rolled up
 * into positions, history, activity, and which positions come from a bank
 * connection whose data is old (lib/connectionState, same as Accounts).
 */
export function useInvestments(linkingItemId: string | null) {
  const holdings = useHoldings();
  const history = useInvestmentHistory();
  const activity = useInvestmentTransactions();
  const accounts = useAccounts();
  const refreshStates = useItemRefreshStates();

  return useMemo(() => {
    const rows = holdings.data?.holdings ?? [];
    const positions = rollUpPositions(rows);
    const itemIds = new Set(rows.map((h) => h.itemId).filter(Boolean));
    const institutions = (accounts.data?.institutions ?? []).filter((i) => itemIds.has(i.id));

    const connections = institutions.map((institution) => {
      const r = refreshStates.get(institution.id);
      const state = connectionState(institution, {
        refreshing: r?.refreshing ?? false,
        linking: linkingItemId === institution.id,
        justReconnected: false,
        refreshFailed: r?.failed ?? false,
      });
      const own = rows.filter((h) => h.itemId === institution.id);
      return {
        institution,
        state,
        accountNames: [...new Set(own.map((h) => h.accountName))],
        value: own.reduce((s, h) => s + h.institutionValue, 0),
      };
    });
    const needsYou: StaleConnection[] = connections.filter((c) => c.state.needsAttention);
    const staleItems = new Set(connections.filter((c) => c.state.dimBalances || c.institution.badge === "serious").map((c) => c.institution.id));
    const syncedAt = new Map(institutions.map((i) => [i.id, i.lastSyncedAt]));
    const itemByAccount = new Map(rows.map((h) => [h.accountId, h.itemId]));

    /** "as of 3h ago" when every lot is stale, "TFSA part as of …" when some are. */
    function staleNote(p: Position): { text: string; partial: boolean } | null {
      const stale = p.lots.filter((l) => staleItems.has(itemByAccount.get(l.accountId) ?? ""));
      if (stale.length === 0) return null;
      const when = ago(syncedAt.get(itemByAccount.get(stale[0]!.accountId) ?? "") ?? null);
      return stale.length === p.lots.length ? { text: `as of ${when}`, partial: false } : { text: `${stale.map((l) => l.accountName).join(", ")} part as of ${when}`, partial: true };
    }

    return {
      isLoading: holdings.isLoading,
      isError: holdings.isError && !holdings.data,
      refetch: () => Promise.all([holdings.refetch(), history.refetch(), activity.refetch()]),
      holdings: rows,
      value: holdings.data?.value ?? 0,
      positions,
      history: history.data?.points ?? [],
      activity: activity.data?.transactions ?? [],
      needsYou,
      staleNote,
    };
  }, [holdings, history, activity, accounts.data, refreshStates, linkingItemId]);
}
