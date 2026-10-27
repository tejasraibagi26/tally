export interface DeselectedAccount {
  id: string;
  name: string;
  mask: string | null;
  institutionName: string | null;
  deselectedAt: string;
}

function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

/**
 * Accounts the user unticked in Plaid's account picker during a reconnect:
 * the bank is still connected, this account isn't shared any more
 * (accounts.deselected_at, set in lib/plaidAccounts.ts). Listed here rather
 * than vanishing, since its transactions are still in the history and the
 * way back -- reconnect the bank and tick it again -- isn't guessable.
 */
export function DeselectedAccounts({ accounts }: { accounts: DeselectedAccount[] }) {
  return (
    <section className="flex flex-col gap-3" aria-labelledby="deselected-heading">
      <div className="flex flex-col gap-0.5 px-1">
        <h2 id="deselected-heading" className="m-0 text-[11px] font-semibold uppercase tracking-wide text-text-3">
          No longer shared · {accounts.length}
        </h2>
        <p className="m-0 text-[13.5px] text-text-2">
          You left these out the last time you reconnected the bank, so Tally stopped receiving them. Their balances are out of every total; what they already recorded stays in your history. Reconnect the bank and tick them to bring them back.
        </p>
      </div>
      <ul className="m-0 p-0 list-none grid grid-cols-1 lg:grid-cols-2 gap-3">
        {accounts.map((a) => (
          <li key={a.id} className="flex items-center gap-3 rounded-card border border-border bg-surface px-4 py-3">
            <div className="flex-1 min-w-0 flex flex-col">
              <span className="text-[14.5px] text-text truncate">
                {a.name}
                {a.mask && <span className="font-mono text-[12.5px] text-text-3"> ····{a.mask}</span>}
              </span>
              <span className="text-[13px] text-text-3 truncate">
                {a.institutionName ?? "Bank"} · stopped sharing {shortDate(a.deselectedAt)}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
