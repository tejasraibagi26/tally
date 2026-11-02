import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { formatCents } from "@tally/core/money";
import { isFirstDayOfMonth, onPaceLine } from "@tally/core/popView";
import { Card } from "@/components/ui/Card";
import { TallyMarks } from "@/components/ui/TallyMarks";
import { cn } from "@/lib/cn";

/* Overview's streak card and banners. */

/**
 * On-pace days: finished days in a row under an even daily pace, as tally
 * marks. On the month's first day nothing has finished yet, so it reads
 * "New month" rather than a zero (@tally/core/popView onPaceLine).
 */
export function OnPaceCard({ streak, dailyPace, today, href, className }: { streak: number; dailyPace: number; today: string; href: string; className?: string }) {
  const fresh = isFirstDayOfMonth(today);
  return (
    <Card className={cn("ui-marigold p-5 flex flex-col gap-2", className)}>
      <span className="text-xs font-semibold uppercase tracking-[0.08em]">On-pace days</span>
      <div className="flex items-center gap-3.5 min-h-[40px]">
        {fresh ? (
          <span className="font-display text-[30px] leading-none">New month</span>
        ) : (
          <>
            <TallyMarks count={streak} height={40} />
            <span className="font-display text-[40px] leading-none tabular">{streak}</span>
          </>
        )}
      </div>
      <p className="m-0 text-[13.5px] leading-snug font-medium">{onPaceLine(streak, dailyPace, today, (c) => formatCents(c))}</p>
      <Link href={href} className="mt-auto text-[13.5px] font-semibold underline underline-offset-2">
        See the days
      </Link>
    </Card>
  );
}

/** "N to tally up": this month's unreviewed transactions, opening the review queue. */
export function TallyUpBanner({ count, className, style }: { count: number; className?: string; style?: React.CSSProperties }) {
  return (
    <Link
      href="/transactions?review=1&queue=1"
      style={style}
      className={cn("ui-tally-up flex flex-wrap items-center gap-3.5 rounded-card border bg-brand-subtle px-4 py-3.5 text-text hover:bg-brand-subtle", className)}
    >
      <span className="w-10 h-10 flex-none rounded-control bg-brand text-on-brand flex items-center justify-center" aria-hidden="true">
        <TallyMarks count={4} height={20} />
      </span>
      <span className="flex-1 min-w-[220px] flex flex-col">
        <span className="font-bold text-[16px] tabular">{count} to tally up</span>
        <span className="text-[13.5px] text-text-2">New transactions Tally isn&apos;t sure about. Takes about a minute.</span>
      </span>
      <span className="inline-flex items-center gap-1 text-[15px] font-bold text-brand">
        Start review <ChevronRight size={16} strokeWidth={2.5} aria-hidden="true" />
      </span>
    </Link>
  );
}

/** January: a banner into the year that just ended (featuredReviewYear in @tally/core/yearReview). */
export function YearReviewBanner({ year, className, style }: { year: number; className?: string; style?: React.CSSProperties }) {
  return (
    <Link
      href={`/year-in-review?year=${year}`}
      style={style}
      className={cn("flex flex-wrap items-center gap-3.5 rounded-card border bg-[var(--marigold,var(--warning-subtle))] px-4 py-3.5 text-[var(--ink-text,var(--text))]", className)}
    >
      <span className="w-10 h-10 flex-none rounded-control bg-surface text-text flex items-center justify-center font-display text-[13.5px]" aria-hidden="true">
        {String(year).slice(2)}
      </span>
      <span className="flex-1 min-w-[220px] flex flex-col">
        <span className="font-bold text-[16px]">Your {year} in review</span>
        <span className="text-[13.5px]">Where the money went, the months that stood out, and how far net worth moved.</span>
      </span>
      <span className="inline-flex items-center gap-1 text-[15px] font-bold">
        See your year <ChevronRight size={16} strokeWidth={2.5} aria-hidden="true" />
      </span>
    </Link>
  );
}
