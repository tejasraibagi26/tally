import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUserId } from "@/lib/session";
import { tagSummaryFor } from "@/lib/tags";
import { formatCents, formatPercent } from "@tally/core/money";
import { Card, CardHeader } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";

function day(d: string, withYear = false): string {
  return new Date(`${d}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: withYear ? "numeric" : undefined, timeZone: "UTC" });
}

/**
 * One tag added up (@tally/core/tagView): what it cost in all, per day,
 * day by day, and by category, with the transactions one click away.
 */
export default async function TagPage({ params }: { params: Promise<{ tag: string }> }) {
  const userId = await requireUserId();
  const tag = decodeURIComponent((await params).tag);
  const s = await tagSummaryFor(userId, tag);
  if (s.count === 0) notFound();

  const maxDay = Math.max(1, ...s.byDay.map((d) => d.total));
  // Every day in the span, so quiet days show as gaps in the chart (capped so a year-long tag stays readable).
  const span: string[] = [];
  if (s.firstDate && s.days <= 120) {
    for (let i = 0; i < s.days; i++) span.push(new Date(Date.parse(`${s.firstDate}T00:00:00Z`) + i * 86_400_000).toISOString().slice(0, 10));
  }
  const byDay = new Map(s.byDay.map((d) => [d.date, d.total]));
  const bars = span.length > 0 ? span.map((d) => ({ date: d, total: byDay.get(d) ?? 0 })) : s.byDay;

  return (
    <div className="max-w-[1080px] mx-auto px-4 lg:px-8 py-5 lg:py-7 flex flex-col gap-6">
      <PageHeader
        title={tag}
        meta={[
          <Link key="all" href="/tags" className="text-brand">
            ← Tags
          </Link>,
          s.firstDate && s.lastDate ? (s.firstDate === s.lastDate ? day(s.firstDate, true) : `${day(s.firstDate)} – ${day(s.lastDate, true)}`) : null,
          `${s.count} transaction${s.count === 1 ? "" : "s"}`,
        ]}
        actions={
          <Link href={`/transactions?tag=${encodeURIComponent(tag)}`} className="ui-btn ui-btn-secondary inline-flex items-center h-9 px-4 rounded-control border border-border-strong bg-surface text-[14px] font-medium text-text hover:bg-sunken">
            See transactions
          </Link>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="ui-hero p-5 flex flex-col gap-2">
          <span className="text-xs font-medium uppercase tracking-wide text-text-3">Total</span>
          <span className="font-display text-[36px] leading-none text-text tabular">{formatCents(s.spend)}</span>
          {s.income > 0 && <span className="text-[13px] text-text-2">{formatCents(s.income)} came back in</span>}
        </Card>
        <Card className="p-5 flex flex-col gap-2">
          <span className="text-xs font-medium uppercase tracking-wide text-text-3">Per day</span>
          <span className="ui-figure font-display text-[30px] leading-none text-text tabular">{s.perDay != null ? formatCents(s.perDay) : "—"}</span>
          <span className="text-[13px] text-text-2">over {s.days} day{s.days === 1 ? "" : "s"}</span>
        </Card>
        <Card className="p-5 flex flex-col gap-2">
          <span className="text-xs font-medium uppercase tracking-wide text-text-3">Biggest share</span>
          <span className="ui-figure font-display text-[30px] leading-none text-text">{s.byCategory[0]?.label ?? "—"}</span>
          {s.byCategory[0] && <span className="text-[13px] text-text-2">{formatPercent(s.byCategory[0].share)} of it</span>}
        </Card>
      </div>

      {bars.length > 1 && (
        <Card className="overflow-hidden">
          <CardHeader title="Day by day" />
          {/* Bars run edge to edge; the date labels stay padded. */}
          <div className="flex items-end gap-[2px] h-[160px] pt-4">
            {bars.map((b) => (
              <span key={b.date} title={`${day(b.date)}: ${formatCents(b.total)}`} className="flex-1 h-full flex items-end">
                <span className="w-full rounded-t-[4px]" style={{ height: b.total > 0 ? `${Math.max(3, (b.total / maxDay) * 100)}%` : "0", background: "var(--series-1)" }} />
              </span>
            ))}
          </div>
          <div className="flex justify-between px-4 py-2 border-t border-border text-[11.5px] text-text-3">
            <span>{day(bars[0]!.date)}</span>
            <span>{day(bars.at(-1)!.date)}</span>
          </div>
        </Card>
      )}

      <Card>
        <CardHeader title="By category" />
        <ul className="m-0 p-5 list-none flex flex-col gap-3.5">
          {s.byCategory.map((c, i) => (
            <li key={c.key} className="flex flex-col gap-1.5">
              <span className="flex justify-between text-[14px]">
                <span className="text-text">{c.label}</span>
                <span className="text-text tabular">
                  {formatCents(c.total)} <span className="text-text-3">· {formatPercent(c.share)}</span>
                </span>
              </span>
              <span className="ui-meter h-2 rounded-full bg-sunken overflow-hidden">
                <span className="block h-full rounded-full" style={{ width: `${c.share * 100}%`, background: `var(--series-${(i % 8) + 1})` }} />
              </span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
