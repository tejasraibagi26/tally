/**
 * How far a budget's remaining money actually carries you, as days rather
 * than a percentage.
 *
 * The Budgets bar is the month: Nov 1 at the left edge, Nov 30 at the right,
 * a mark for today, and a filled segment running from today as far as what's
 * left lasts at the rate being spent. A full-width bar means "this reaches
 * month end"; a stub means "this runs out on the 11th". The reader gets an
 * answer instead of a ratio.
 *
 * Shared by web and mobile so a budget says the same sentence in both. Pure:
 * callers pass "days elapsed" from the user's own date and format money
 * through `formatMoney`, the same contract as @tally/core/budgetView.
 */

/** Falling this close to month end reads as landing short, not running dry. */
export const SHORT_GRACE_DAYS = 2;

export type RunwayState =
  /** Reaches month end at the current rate. */
  | "carries"
  /** Falls within SHORT_GRACE_DAYS of month end. */
  | "lands_short"
  /** Runs out well before month end. */
  | "runs_dry"
  /** Already spent past the budget. */
  | "over"
  /** A fixed amount: a bill, not a decision with a rate. */
  | "fixed"
  /** Nothing spent yet, so there is no rate to project. */
  | "untouched"
  /** A past or future month, where a rate means nothing. */
  | "not_current";

export interface RunwayInput {
  /** amount + rolloverFromPrior, cents. */
  available: number;
  spend: number;
  isFixedAmount: boolean;
}

export interface RunwayContext {
  /** Day of the month today, 1-based. Omitted for a month that isn't in progress. */
  daysElapsed?: number;
  daysInMonth: number;
}

/** A run of sentence text, with the parts worth emphasising marked. */
export interface SentencePart {
  text: string;
  /** Render bold: the verdict, and the rate or date it turns on. */
  strong?: boolean;
}

export interface Runway {
  state: RunwayState;
  left: number;
  /** Cents a day spent so far. Null when nothing is spent or the month isn't in progress. */
  rate: number | null;
  /** Cents a day what's left allows over the days remaining, today included. Null when over. */
  allowance: number | null;
  /** Day of the month the money runs out at the current rate. Null when it carries past month end. */
  runsOutDay: number | null;
  /** 0..1 of the bar that is already behind you. */
  todayPct: number;
  /** 0..1 of the bar the remaining money covers, measured from todayPct. */
  carryPct: number;
  /** One or two sentences for under the bar, plain. */
  sentence: string;
  /**
   * The same sentence split so a view can bold what matters: the verdict
   * and the figure it hangs on. Joining every `text` gives `sentence`.
   */
  parts: SentencePart[];
}

function ordinal(day: number): string {
  const rem100 = day % 100;
  if (rem100 >= 11 && rem100 <= 13) return `${day}th`;
  switch (day % 10) {
    case 1:
      return `${day}st`;
    case 2:
      return `${day}nd`;
    case 3:
      return `${day}rd`;
    default:
      return `${day}th`;
  }
}

function plural(n: number, word: string): string {
  return `${n} ${n === 1 ? word : `${word}s`}`;
}

/** Joins the parts into the plain sentence, so the two can never drift. */
function say(parts: SentencePart[]): { sentence: string; parts: SentencePart[] } {
  return { sentence: parts.map((p) => p.text).join(""), parts };
}

export function budgetRunway(line: RunwayInput, ctx: RunwayContext, formatMoney: (cents: number) => string): Runway {
  const { available, spend, isFixedAmount } = line;
  const { daysInMonth } = ctx;
  const left = available - spend;
  const current = ctx.daysElapsed != null && ctx.daysElapsed >= 1 && daysInMonth > 0;
  const todayPct = current ? Math.min(1, ctx.daysElapsed! / daysInMonth) : 0;
  // Today counts as a day you can still spend, matching budgetView's monthSummary.
  const daysLeft = current ? Math.max(0, daysInMonth - ctx.daysElapsed! + 1) : daysInMonth;
  const allowance = left > 0 && daysLeft > 0 ? left / daysLeft : null;
  const base = { left, todayPct, rate: null, allowance, runsOutDay: null };

  if (!current) {
    return { ...base, state: "not_current", allowance: null, carryPct: 0, ...say([{ text: formatMoney(available), strong: true }, { text: " budgeted." }]) };
  }

  if (isFixedAmount) {
    const parts: SentencePart[] =
      spend >= available
        ? [{ text: "Paid in full.", strong: true }, { text: " Nothing here is still a decision." }]
        : spend > 0
          ? [{ text: `${formatMoney(spend)} of ${formatMoney(available)}`, strong: true }, { text: " paid so far." }]
          : [{ text: "Not paid yet." }, { text: ` ${formatMoney(available)}`, strong: true }, { text: " is set aside for it." }];
    // A fixed amount has no runway: the whole bar reads as settled.
    return { ...base, state: "fixed", allowance: null, carryPct: spend >= available ? 1 - todayPct : 0, ...say(parts) };
  }

  if (spend > available) {
    return {
      ...base,
      state: "over",
      allowance: null,
      carryPct: 0,
      ...say([{ text: `${formatMoney(spend - available)} over`, strong: true }, { text: `, on day ${ctx.daysElapsed}.` }]),
    };
  }

  if (spend <= 0) {
    return {
      ...base,
      state: "untouched",
      carryPct: 1 - todayPct,
      ...say([
        { text: "Untouched." },
        { text: ` The whole ${formatMoney(available)}`, strong: true },
        { text: " is still there, and there is no rate to project yet." },
      ]),
    };
  }

  const rate = spend / ctx.daysElapsed!;
  const lasts = rate > 0 ? left / rate : Infinity;
  const daysToEnd = daysInMonth - ctx.daysElapsed!;
  const carryPct = Math.max(0, Math.min(1 - todayPct, lasts / daysInMonth));
  const runsOutDay = lasts >= daysToEnd ? null : Math.max(ctx.daysElapsed!, Math.round(ctx.daysElapsed! + lasts));
  const perDay = allowance != null ? `${formatMoney(Math.floor(allowance))} a day` : "nothing a day";

  if (lasts >= daysToEnd) {
    return {
      ...base,
      state: "carries",
      rate,
      carryPct,
      ...say([
        { text: "Carries past month end." },
        { text: ` ${perDay}`, strong: true },
        { text: ` to the ${ordinal(daysInMonth)}.` },
      ]),
    };
  }

  const shortBy = Math.max(1, Math.round(daysToEnd - lasts));
  if (daysToEnd - lasts <= SHORT_GRACE_DAYS) {
    return {
      ...base,
      state: "lands_short",
      rate,
      runsOutDay,
      carryPct,
      ...say([
        { text: `Lands on the ${ordinal(runsOutDay!)}`, strong: true },
        { text: `, ${plural(shortBy, "day")} shy. ${perDay} holds it to the end.` },
      ]),
    };
  }

  return {
    ...base,
    state: "runs_dry",
    rate,
    runsOutDay,
    carryPct,
    ...say([
      { text: `Runs dry on the ${ordinal(runsOutDay!)}`, strong: true },
      { text: `. You're going ${formatMoney(Math.round(rate))} a day; reaching the ${ordinal(daysInMonth)} needs ${perDay}.` },
    ]),
  };
}
