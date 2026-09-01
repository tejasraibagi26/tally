/** Pure recurring/subscription detection (WORK.md §7.5) — no DB import, testable without Postgres. */

export type RecurringFrequency = "weekly" | "biweekly" | "monthly" | "quarterly" | "annual";
export type RecurringStatus = "active" | "at_risk" | "cancelled";

const FREQUENCY_TARGET_DAYS: Record<RecurringFrequency, number> = {
  weekly: 7,
  biweekly: 14,
  monthly: 30,
  quarterly: 91,
  annual: 365,
};

export interface RecurringCandidate {
  id: string;
  accountId: string;
  categoryId: string | null;
  merchantKey: string; // pre-normalized — see normalizeMerchantKey()
  description: string;
  amount: number; // cents, signed
  postedDate: string; // YYYY-MM-DD
}

export interface DetectedStream {
  merchantKey: string;
  description: string;
  accountId: string;
  categoryId: string | null;
  averageAmount: number; // cents, signed (preserves the direction of the underlying transactions)
  frequency: RecurringFrequency;
  lastDate: string;
  predictedNextDate: string;
  status: RecurringStatus;
  confidence: number; // 0–1
  transactionIds: string[];
}

/** Strips store numbers/reference codes so "WHOLEFDS MKT #103" and "AMAZON.COM*A1B2C3" cluster with their own merchant, not each transaction's unique suffix. */
export function normalizeMerchantKey(nameOrMerchant: string): string {
  return nameOrMerchant
    .toLowerCase()
    .replace(/#\s*\w+$/, "")
    .replace(/\*\w+$/, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function daysBetween(a: string, b: string): number {
  return (new Date(b + "T00:00:00Z").getTime() - new Date(a + "T00:00:00Z").getTime()) / 86_400_000;
}

function addDays(date: string, days: number): string {
  const d = new Date(date + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + Math.round(days));
  return d.toISOString().slice(0, 10);
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2 : (sorted[mid] ?? 0);
}

function closestFrequency(days: number): RecurringFrequency {
  let best: RecurringFrequency = "monthly";
  let bestDiff = Infinity;
  for (const [freq, target] of Object.entries(FREQUENCY_TARGET_DAYS) as [RecurringFrequency, number][]) {
    const diff = Math.abs(days - target);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = freq;
    }
  }
  return best;
}

/** $1 amount band — subscriptions repeat at (near-)identical amounts; a wider band risks conflating two different merchants sharing a merchantKey collision. */
function amountBand(amountCents: number): number {
  return Math.round(Math.abs(amountCents) / 100);
}

// An annual subscription only charges once a year, so waiting for the usual
// ≥3-occurrence bar would take 2+ years of history before it's ever
// surfaced. A single ~365-day gap between two same-merchant/same-amount-band
// charges is a much tighter tell than two occurrences of, say, a monthly
// charge, so it's allowed to promote to a (low-confidence, amortizeMonthly
// defaults false — see schema.ts) annual candidate on its own.
const ANNUAL_TWO_OCCURRENCE_GAP_RANGE: [number, number] = [350, 380];

/**
 * Groups by merchant + account + amount band, requires ≥3 occurrences with
 * a stable interval (every gap within ±4 days of the median gap) to promote
 * to a stream — except a two-occurrence group whose single gap lands in the
 * annual band, which promotes on its own (see ANNUAL_TWO_OCCURRENCE_GAP_RANGE
 * above). `now` is injected (not `new Date()`) so status classification is a
 * pure, testable function of its inputs.
 */
export function detectRecurringStreams(candidates: RecurringCandidate[], now: string): DetectedStream[] {
  const groups = new Map<string, RecurringCandidate[]>();
  for (const c of candidates) {
    const key = `${c.accountId}::${c.merchantKey}::${amountBand(c.amount)}`;
    groups.set(key, [...(groups.get(key) ?? []), c]);
  }

  const streams: DetectedStream[] = [];
  for (const group of groups.values()) {
    const sorted = [...group].sort((a, b) => a.postedDate.localeCompare(b.postedDate));

    const gaps: number[] = [];
    for (let i = 1; i < sorted.length; i++) {
      gaps.push(daysBetween(sorted[i - 1]!.postedDate, sorted[i]!.postedDate));
    }

    const isAnnualPair =
      group.length === 2 &&
      gaps[0]! >= ANNUAL_TWO_OCCURRENCE_GAP_RANGE[0] &&
      gaps[0]! <= ANNUAL_TWO_OCCURRENCE_GAP_RANGE[1];
    if (group.length < 3 && !isAnnualPair) continue;

    const medianGap = median(gaps);
    if (medianGap <= 0) continue;

    const maxDeviation = Math.max(...gaps.map((g) => Math.abs(g - medianGap)));
    const stable = isAnnualPair || maxDeviation <= 4;
    if (!stable) continue;

    const last = sorted[sorted.length - 1]!;
    const predictedNextDate = addDays(last.postedDate, medianGap);
    const daysPastPredicted = daysBetween(predictedNextDate, now);

    let status: RecurringStatus;
    if (daysPastPredicted <= 10) status = "active";
    else if (daysPastPredicted <= medianGap + 10) status = "at_risk";
    else status = "cancelled";

    const averageAmount = Math.round(sorted.reduce((sum, c) => sum + c.amount, 0) / sorted.length);
    const stabilityScore = isAnnualPair ? 1 : Math.max(0, 1 - maxDeviation / 4);
    const countBonus = Math.min(1, sorted.length / 6);
    // Two points a year apart is much weaker evidence than two points a week
    // or month apart (no way yet to tell a coincidence from a real cadence),
    // so halve the usual formula's result for an annual pair specifically.
    const confidence = Math.max(0, Math.min(1, (stabilityScore * 0.7 + countBonus * 0.3) * (isAnnualPair ? 0.5 : 1)));

    streams.push({
      merchantKey: last.merchantKey,
      description: last.description,
      accountId: last.accountId,
      categoryId: last.categoryId,
      averageAmount,
      frequency: closestFrequency(medianGap),
      lastDate: last.postedDate,
      predictedNextDate,
      status,
      confidence,
      transactionIds: sorted.map((c) => c.id),
    });
  }

  return streams;
}
