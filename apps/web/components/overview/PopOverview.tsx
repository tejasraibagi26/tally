import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { formatCents } from "@tally/core/money";
import { Card } from "@/components/ui/Card";
import { TallyMarks } from "@/components/ui/TallyMarks";
import { cn } from "@/lib/cn";

/*
 * Overview pieces that only exist in the Tally Pop preview. They render for
 * everyone and globals.css hides them (.pop-only) unless html[data-ui="pop"],
 * so the "New look" switch flips instantly without a reload.
 */

/** On-pace days: finished days in a row under an even daily pace, as tally marks. */
export function OnPaceCard({ streak, dailyPace, href, className }: { streak: number; dailyPace: number; href: string; className?: string }) {
  const next = 5 - (streak % 5);
  return (
    <Card className={cn("ui-marigold p-5 flex flex-col gap-2", className)}>
      <span className="text-xs font-semibold uppercase tracking-[0.08em]">On-pace days</span>
      <div className="flex items-center gap-3.5 min-h-[40px]">
        <TallyMarks count={streak} height={40} />
        <span className="font-display text-[40px] leading-none tabular">{streak}</span>
      </div>
      <p className="m-0 text-[14px] leading-snug font-medium">
        {streak === 0
          ? `Yesterday went over your ${formatCents(dailyPace)} daily pace. Today's a fresh start.`
          : `${streak === 1 ? "Day" : "Days"} in a row under your ${formatCents(dailyPace)} daily pace.${streak < 15 ? ` ${next === 1 ? "One more closes" : `${next} more close`} the next five.` : ""}`}
      </p>
      <Link href={href} className="mt-auto text-[13px] font-semibold underline underline-offset-2">
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
        <span className="text-[14px] text-text-2">New transactions Tally isn&apos;t sure about. Takes about a minute.</span>
      </span>
      <span className="inline-flex items-center gap-1 text-[15px] font-bold text-brand">
        Start review <ChevronRight size={16} strokeWidth={2.5} aria-hidden="true" />
      </span>
    </Link>
  );
}
