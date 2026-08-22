/**
 * Pure transfer pairing (WORK.md §7.4). Pairs transactions across accounts
 * when opposite signs, |amount| equal within 1%, and dates within 4 days —
 * spec also allows the pair to qualify via "card<->bank OR both accounts
 * are user-owned"; every connected account in this single-user app is
 * user-owned, so that clause is always satisfied and imposes no further
 * restriction on which account types can pair (checking<->savings and
 * checking<->brokerage transfers are just as valid as checking<->credit).
 */

const DATE_WINDOW_DAYS = 4;
const AMOUNT_TOLERANCE = 0.01;

export interface TransferCandidate {
  id: string;
  accountId: string;
  amount: number; // cents, signed
  postedDate: string; // YYYY-MM-DD
}

export interface TransferPair {
  a: TransferCandidate;
  b: TransferCandidate;
}

function daysBetween(a: string, b: string): number {
  const msPerDay = 86_400_000;
  return Math.abs(new Date(a + "T00:00:00Z").getTime() - new Date(b + "T00:00:00Z").getTime()) / msPerDay;
}

function amountsMatch(a: number, b: number): boolean {
  const magA = Math.abs(a);
  const magB = Math.abs(b);
  if (magA === 0 || magB === 0) return magA === magB;
  return Math.abs(magA - magB) / Math.max(magA, magB) <= AMOUNT_TOLERANCE;
}

/**
 * Greedily pairs candidates (already filtered to `is_transfer = false` by
 * the caller) into transfer groups. Each candidate is used at most once —
 * first valid match wins, oldest-first, which keeps the result stable and
 * avoids the combinatorial matching problem full optimal pairing would need
 * at this volume (hundreds, not millions, of candidates per run).
 */
export function findTransferPairs(candidates: TransferCandidate[]): TransferPair[] {
  const sorted = [...candidates].sort((a, b) => a.postedDate.localeCompare(b.postedDate));
  const used = new Set<string>();
  const pairs: TransferPair[] = [];

  for (let i = 0; i < sorted.length; i++) {
    const a = sorted[i];
    if (!a || used.has(a.id)) continue;

    for (let j = i + 1; j < sorted.length; j++) {
      const b = sorted[j];
      if (!b || used.has(b.id)) continue;
      if (daysBetween(a.postedDate, b.postedDate) > DATE_WINDOW_DAYS) break; // sorted by date — no later b can match either
      if (a.accountId === b.accountId) continue; // must be cross-account
      if (Math.sign(a.amount) === Math.sign(b.amount)) continue; // must be opposite signs
      if (!amountsMatch(a.amount, b.amount)) continue;

      used.add(a.id);
      used.add(b.id);
      pairs.push({ a, b });
      break;
    }
  }

  return pairs;
}
