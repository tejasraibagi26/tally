import { LinkButton } from "@/components/plaid/LinkButton";

export interface DisconnectedBank {
  id: string;
  institutionName: string | null;
  disconnectedAt: string;
  accounts: { id: string; name: string; mask: string | null }[];
}

function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function initials(name: string | null): string {
  const words = (name ?? "?").split(/\s+/).filter(Boolean);
  return ((words[0]?.[0] ?? "?") + (words[1]?.[0] ?? "")).toUpperCase();
}

/**
 * Banks the user disconnected (lib/reattach.ts), below the live ones. Their
 * transactions still count; their balances are frozen, so they're out of
 * the totals above. Reconnect starts a normal Plaid Link session -- the
 * exchange recognises the institution and picks the history back up.
 */
export function DisconnectedBanks({ banks, mock }: { banks: DisconnectedBank[]; mock: boolean }) {
  return (
    <section className="flex flex-col gap-3" aria-labelledby="disconnected-heading">
      <div className="flex flex-col gap-0.5 px-1">
        <h2 id="disconnected-heading" className="m-0 text-[11px] font-semibold uppercase tracking-wide text-text-3">
          Disconnected · {banks.length}
        </h2>
        <p className="m-0 text-[13.5px] text-text-2">
          Their transactions still count in spending and budgets. Balances stopped updating, so they&apos;re left out of the totals. Reconnect to pick up where you left off.
        </p>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {banks.map((bank) => (
          <div key={bank.id} className="flex flex-col gap-3 rounded-card border border-border bg-surface p-5">
            <div className="flex items-center gap-3">
              <span className="w-[34px] h-[34px] flex-none rounded-[9px] flex items-center justify-center bg-sunken text-text-2 text-sm font-medium">
                {initials(bank.institutionName)}
              </span>
              <div className="flex-1 min-w-0 flex flex-col">
                <span className="text-[15px] font-medium text-text truncate">{bank.institutionName ?? "Bank"}</span>
                <span className="text-[13px] text-text-3">Disconnected {shortDate(bank.disconnectedAt)} · history kept</span>
              </div>
              <LinkButton mode="create" label="Reconnect" variant="secondary" size="sm" mock={mock} />
            </div>
            {bank.accounts.length > 0 && (
              <ul className="m-0 p-0 list-none flex flex-col gap-1.5 border-t border-border pt-3">
                {bank.accounts.map((a) => (
                  <li key={a.id} className="flex justify-between gap-3 text-[13.5px] text-text-2">
                    <span className="truncate">{a.name}</span>
                    {a.mask && <span className="font-mono text-[12.5px] text-text-3 flex-none">····{a.mask}</span>}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
