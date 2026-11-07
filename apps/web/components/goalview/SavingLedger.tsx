import { formatCents } from "@tally/core/money";
import { PACE_MONTHS } from "@tally/core/goalMath";
import { Card, CardHeader } from "@/components/ui/Card";

export interface LedgerMonth {
  month: string;
  /** Income minus spend for that month, cents. Can be negative. */
  saved: number;
  /** The month in progress, which is not finished and not in the pace window. */
  inProgress: boolean;
  /** One of the PACE_MONTHS full months the pace is averaged over. */
  inPaceWindow: boolean;
}

function M({ cents }: { cents: number }) {
  return (
    <span className="money money-fit">
      <span>{formatCents(Math.round(cents))}</span>
    </span>
  );
}

function shortMonth(month: string): string {
  return new Date(`${month}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", timeZone: "UTC" }).toUpperCase();
}

/** Plot height in px. Bars and the requirement line share this one scale. */
const PLOT = 120;

/**
 * What you have actually saved, month by month, against what the goal needs.
 *
 * This is the accountability band, and it is deliberately a record rather
 * than a streak: amounts against a requirement, with the months that drive
 * the verdict above marked. A run of bars under the line is the message, and
 * no badge would say it better.
 */
export function SavingLedger({
  months,
  neededPerMonth,
  daysLeft,
}: {
  months: LedgerMonth[];
  neededPerMonth: number | null;
  /** Days left in the month in progress, for its column label. */
  daysLeft: number | null;
}) {
  if (months.length === 0) return null;

  const peak = Math.max(neededPerMonth ?? 0, ...months.map((m) => Math.abs(m.saved)), 1);
  // Leave headroom so a month that beats the requirement still has bar to draw.
  const scale = peak / 0.9;
  const height = (cents: number) => Math.max(2, Math.round((Math.max(0, cents) / scale) * PLOT));
  const needBottom = neededPerMonth != null ? Math.round((neededPerMonth / scale) * PLOT) : null;

  const full = months.filter((m) => !m.inProgress);
  const reached = neededPerMonth != null ? full.filter((m) => m.saved >= neededPerMonth).length : null;
  const window = months.filter((m) => m.inPaceWindow);
  const slipping =
    window.length === PACE_MONTHS && window.every((m, i) => i === 0 || m.saved <= window[i - 1]!.saved);

  return (
    <Card>
      <CardHeader title="What you've actually saved" meta={`Last ${months.length} months`} />
      <div className="p-5">
        <div className="pt-7">
          <div className="relative grid gap-4" style={{ gridTemplateColumns: `repeat(${months.length}, minmax(0, 1fr))`, height: PLOT, alignItems: "end" }}>
            {needBottom != null && (
              <span className="absolute left-0 right-0 border-t border-dashed border-border-strong" style={{ bottom: needBottom }} aria-hidden="true">
                <span className="absolute -top-5 right-0 bg-surface px-1.5 text-[11.5px] font-medium text-text-3 tabular">
                  Goal needs <M cents={neededPerMonth!} />
                </span>
              </span>
            )}
            {months.map((m) => (
              <div key={m.month} className="flex h-full flex-col justify-end">
                <span className={`mb-1.5 text-center text-[12.5px] tabular ${m.inPaceWindow ? "font-medium text-text" : "text-text-2"}`}>
                  <M cents={m.saved} />
                </span>
                <span
                  className={`rounded-t-[4px] ${m.inProgress ? "bg-brand-subtle border border-b-0 border-dashed border-brand-border" : m.inPaceWindow ? "bg-brand" : "bg-brand-subtle"}`}
                  style={{ height: height(m.saved) }}
                  aria-hidden="true"
                />
              </div>
            ))}
          </div>
          <div className="grid gap-4 border-t border-border pt-2" style={{ gridTemplateColumns: `repeat(${months.length}, minmax(0, 1fr))` }}>
            {months.map((m) => (
              <span key={m.month} className={`text-center text-[11.5px] font-medium tracking-[0.04em] ${m.inProgress ? "text-text-2" : "text-text-3"}`}>
                {shortMonth(m.month)}
                {m.inProgress && daysLeft != null && <span className="font-normal"> · {daysLeft} left</span>}
              </span>
            ))}
          </div>
        </div>

        <p className="mt-4 text-[13px] text-text-2 tabular">
          <span className="font-medium text-text">Solid bars are the {PACE_MONTHS} months your pace is measured over.</span>{" "}
          {slipping && "Your saving has slipped every month of that window. "}
          {reached === 0
            ? "No full month on file has reached what the goal needs."
            : reached != null
              ? `${reached} of the last ${full.length} full months reached what the goal needs.`
              : "Set a goal and this line tells you how many months cleared it."}
        </p>
      </div>
    </Card>
  );
}
