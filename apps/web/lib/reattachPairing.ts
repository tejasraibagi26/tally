export interface PairableRow {
  id: string;
  accountId: string;
  postedDate: string;
  amount: number;
  name: string;
  merchantName: string | null;
}

function normalizeName(s: string | null): string {
  return (s ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

/**
 * Pairs each re-synced transaction with its kept twin after a reconnect
 * (lib/reattach.ts). Two passes: exact (account, date, amount, name), then
 * (account, date, amount) only where that's unique on both sides -- Plaid
 * occasionally cleans a name up between connections, but two same-day
 * same-amount charges at different shops must never be guessed at.
 */
export function pairReattached<T extends PairableRow>(kept: T[], fresh: T[]): [T, T][] {
  const pairs: [T, T][] = [];
  const pairedKept = new Set<string>();
  const pairedFresh = new Set<string>();

  for (const withName of [true, false]) {
    const key = (r: T) => `${r.accountId}|${r.postedDate}|${r.amount}${withName ? `|${normalizeName(r.merchantName ?? r.name)}` : ""}`;
    const group = (rows: T[], used: Set<string>) => {
      const m = new Map<string, T[]>();
      for (const r of rows) if (!used.has(r.id)) m.set(key(r), [...(m.get(key(r)) ?? []), r]);
      return m;
    };
    const keptByKey = group(kept, pairedKept);
    const freshByKey = group(fresh, pairedFresh);
    for (const [k, olds] of keptByKey) {
      const news = freshByKey.get(k) ?? [];
      if (!withName && (olds.length !== 1 || news.length !== 1)) continue;
      for (let i = 0; i < Math.min(olds.length, news.length); i++) {
        pairs.push([olds[i]!, news[i]!]);
        pairedKept.add(olds[i]!.id);
        pairedFresh.add(news[i]!.id);
      }
    }
  }
  return pairs;
}
