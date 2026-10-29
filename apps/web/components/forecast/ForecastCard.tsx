import Link from "next/link";
import { formatCents } from "@tally/core/money";
import type { Forecast } from "@tally/core/forecast";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/cn";

const SHORT = (date: string) =>
  new Date(`${date}T00:00:00Z`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });

/**
 * Overview's forecast strip: the headline and its cause, nothing else. The
 * whole card is one link into /forecast — repeating the ledger here would
 * make two places to read the same thing and two places to keep right.
 *
 * The sparkline is decorative and marked aria-hidden: the figures beside it
 * already say everything it shows.
 */
export function ForecastCard({ forecast: f }: { forecast: Forecast }) {
  const h = f.headline;
  if (!h) return null;
  const short = h.kind === "shortfall";

  // A sparkline wants one point per few days, not sixty.
  const step = Math.max(1, Math.floor(f.days.length / 40));
  const sampled = f.days.filter((_, i) => i % step === 0 || i === f.days.length - 1);
  const values = sampled.map((d) => d.balance);
  const min = Math.min(...values, f.cushion);
  const max = Math.max(...values, f.cushion);
  const span = max - min || 1;
  const x = (i: number) => (i / (sampled.length - 1 || 1)) * 240;
  const y = (v: number) => 56 - ((v - min) / span) * 48;
  const dipIndex = sampled.findIndex((d) => d.date === h.date);

  return (
    <Card className={cn("p-5", short && "ui-card-negative")}>
      <Link href="/forecast" className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="ui-card-title m-0 text-[15px] font-semibold text-text">The next {f.days.length - 1} days</h2>
          <span className="text-[12px] font-semibold text-brand">Forecast →</span>
        </div>
        <div className="flex items-end gap-4">
          <div>
            <div className={cn("money ui-card-title text-[30px] leading-tight tabular", short ? "text-negative" : "text-text")}>
              <span>{formatCents(h.amount)}</span>
            </div>
            <div className="mt-0.5 text-[13px] text-text-2">
              {short ? "Short on " : "Lowest on "}
              <strong className="font-semibold text-text">{SHORT(h.date)}</strong>
            </div>
          </div>
          <svg viewBox="0 0 240 64" className="ml-auto hidden h-16 w-60 sm:block" aria-hidden>
            {f.cushion > 0 && <line x1="0" y1={y(f.cushion)} x2="240" y2={y(f.cushion)} stroke="var(--brand)" strokeWidth="1.2" strokeDasharray="4 3" />}
            <polyline
              fill="none"
              stroke="var(--series-1)"
              strokeWidth="2.5"
              strokeLinejoin="round"
              points={values.map((v, i) => `${x(i)},${y(v)}`).join(" ")}
            />
            {dipIndex >= 0 && short && (
              <circle cx={x(dipIndex)} cy={y(values[dipIndex]!)} r="4.5" fill="var(--status-critical)" stroke="var(--surface)" strokeWidth="2" />
            )}
          </svg>
        </div>
        {h.causes.length > 0 && (
          <p className="m-0 border-t border-border pt-3 text-[12.5px] leading-snug text-text-2">
            <strong className="font-semibold text-text">{h.causes[0]!.label}</strong>{" "}
            <span className="money tabular">({formatCents(h.causes[0]!.amount)})</span> comes out first.
          </p>
        )}
      </Link>
    </Card>
  );
}
