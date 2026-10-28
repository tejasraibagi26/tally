import Link from "next/link";
import { Tag } from "lucide-react";
import { requireUserId } from "@/lib/session";
import { tagsFor } from "@/lib/tags";
import { formatCents } from "@tally/core/money";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";

function range(first: string, last: string): string {
  const f = (d: string, year: boolean) => new Date(`${d}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: year ? "numeric" : undefined, timeZone: "UTC" });
  if (first === last) return f(first, true);
  return `${f(first, first.slice(0, 4) !== last.slice(0, 4))} – ${f(last, true)}`;
}

/** Every tag, most recently used first: a trip, a wedding, a project, summed across categories. */
export default async function TagsPage() {
  const userId = await requireUserId();
  const tags = await tagsFor(userId);

  return (
    <div className="max-w-[1080px] mx-auto px-4 lg:px-8 py-5 lg:py-7 flex flex-col gap-6">
      <PageHeader title="Tags" meta={[tags.length > 0 ? `${tags.length} tag${tags.length === 1 ? "" : "s"}` : "Add up a trip, an event or a project across categories"]} />
      {tags.length === 0 ? (
        <Card className="p-12">
          <EmptyState
            icon={Tag}
            title="No tags yet"
            description="Tag transactions to add them up across categories, like a trip's flights, hotels and meals. On Transactions, filter to the dates, select them and choose Tag. You can also tag one transaction from its panel, or have a rule do it."
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {tags.map((t) => (
            <Link key={t.tag} href={`/tags/${encodeURIComponent(t.tag)}`} className="bg-surface border border-border rounded-card shadow-raised p-5 flex flex-col gap-2 hover:border-border-strong transition-colors">
              <span className="inline-flex items-center gap-1.5 self-start rounded-full bg-brand-subtle text-brand px-2.5 py-0.5 text-[13px] font-semibold">
                <Tag size={13} strokeWidth={2.2} aria-hidden="true" />
                {t.tag}
              </span>
              <span className="ui-figure font-display text-[30px] leading-none text-text tabular">{formatCents(t.spend)}</span>
              <span className="text-[13px] text-text-2">
                {t.count} transaction{t.count === 1 ? "" : "s"} · {range(t.firstDate, t.lastDate)}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
