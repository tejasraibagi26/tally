import Link from "next/link";
import { formatCents } from "@tally/core/money";
import { PACE_MONTHS } from "@tally/core/goalMath";
import { Card, CardHeader } from "@/components/ui/Card";
import type { GoalSummary } from "@/lib/goals";

function M({ cents }: { cents: number }) {
  return (
    <span className="money money-fit">
      <span>{formatCents(Math.round(cents))}</span>
    </span>
  );
}

/**
 * Why net worth is moving: the pace split into the half you steer and the
 * half you don't.
 *
 * goalMath already gives both numbers. `pace` is the whole monthly movement;
 * `saving` is income minus spend over the same window. The difference is
 * markets and debt paydown, which is not a decision anyone makes at a till.
 * Drawing them apart is the point of the band: it turns "you are behind" into
 * "you are behind by this much spending".
 *
 * Scaled so the dashed requirement mark sits at 88% of the track, leaving the
 * bar room to overshoot it when the pace is ahead.
 */
const MARK_PCT = 0.88;

export function PaceSplit({ summary, children }: { summary: GoalSummary; children?: React.ReactNode }) {
  const { projection: p } = summary;
  const pace = p.pace;
  const saving = p.saving;
  const needed = p.neededPerMonth;

  // Without a pace there is nothing to split; the caller shows the plain goal card instead.
  if (pace == null) return null;

  const other = saving != null ? pace - saving : null;
  const scale = Math.max(needed ?? 0, pace, 1) / MARK_PCT;
  const pct = (cents: number) => `${Math.max(0, Math.min(100, (cents / scale) * 100))}%`;
  const shortfall = p.shortBy;

  return (
    <Card>
      <CardHeader title="Why net worth is moving" action={<Link href="/goals" className="text-brand text-[13.5px]">Your goal →</Link>} />
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="p-5 lg:border-r border-border">
          <span className="text-xs font-semibold uppercase tracking-[0.07em] text-text-3">
            Average month, last {PACE_MONTHS} full months
          </span>

          <div className="relative mt-8">
            <div className="flex h-8 rounded-control bg-sunken overflow-hidden" aria-hidden="true">
              {saving != null && saving > 0 && <span className="h-full bg-brand" style={{ width: pct(saving) }} />}
              {other != null && other > 0 && <span className="h-full bg-brand-subtle" style={{ width: pct(other) }} />}
              {saving == null && <span className="h-full bg-brand" style={{ width: pct(pace) }} />}
            </div>
            {needed != null && (
              <>
                <span className="absolute -top-2 -bottom-2 border-l border-dashed border-border-strong" style={{ left: `${MARK_PCT * 100}%` }} aria-hidden="true" />
                {/* Hangs to the left of the mark. Anchored at it, a nowrap
                    label starting 88% along ran straight off the card. */}
                <span
                  className="absolute -top-6 whitespace-nowrap pr-1.5 text-[11.5px] font-semibold text-text-3 tabular"
                  style={{ right: `${(1 - MARK_PCT) * 100}%` }}
                >
                  Goal needs <M cents={needed} />
                </span>
              </>
            )}
          </div>

          <div className="mt-6 flex flex-wrap gap-x-7 gap-y-4">
            {saving != null && (
              <span className="flex gap-2.5 max-w-[31ch]">
                <span className="mt-1 w-2.5 h-2.5 flex-none rounded-[2px] bg-brand" aria-hidden="true" />
                <span className="text-[13px] text-text-3">
                  <span className="block font-medium text-text tabular"><M cents={saving} /> saved</span>
                  Income minus everything you spent. The only half you steer.
                </span>
              </span>
            )}
            {other != null && (
              <span className="flex gap-2.5 max-w-[31ch]">
                <span className="mt-1 w-2.5 h-2.5 flex-none rounded-[2px] bg-brand-subtle border border-brand-border" aria-hidden="true" />
                <span className="text-[13px] text-text-3">
                  <span className="block font-medium text-text tabular"><M cents={other} /> markets and debt</span>
                  Portfolio moves and principal paid down. Not a decision.
                </span>
              </span>
            )}
          </div>

          {shortfall != null && saving != null && (
            <p className="mt-5 pt-4 border-t border-border text-[14px] text-text-2 tabular">
              So the gap is not <M cents={shortfall} /> of investing luck. It is{" "}
              <span className="font-medium text-text"><M cents={shortfall} /> a month of spending</span>, which would take your saving
              to <M cents={saving + shortfall} />.
            </p>
          )}
          {shortfall == null && (
            <p className="mt-5 pt-4 border-t border-border text-[14px] text-text-2">
              Your pace is ahead of what the goal needs. Holding the saving half is what keeps it there.
            </p>
          )}
        </div>

        {children && <div className="p-5 border-t lg:border-t-0 border-border">{children}</div>}
      </div>
    </Card>
  );
}
